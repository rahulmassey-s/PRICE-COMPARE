import type { User as FirebaseAuthUser } from 'firebase/auth';
import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy,
  Timestamp,
  serverTimestamp
} from './client'; // Use client-side Firebase setup
import { runTransaction, onSnapshot } from 'firebase/firestore';
import type { UserDetails, Booking, BookingItem } from '@/types';

/**
 * Fetches an existing user document from Firestore or creates a new one if it doesn't exist.
 * Converts Firestore Timestamps to JS Date objects for fields like createdAt, lastUpdatedAt.
 * @param user The Firebase Auth user object.
 * @param mobileNumber Optional: Mobile number to use when creating a new user document.
 * @returns A Promise that resolves to the UserDetails object or null if an error occurs.
 */
export async function getOrCreateUserDocument(user: FirebaseAuthUser, mobileNumber?: string): Promise<UserDetails | null> {
  if (!user) return null;

  const userRef = doc(db, 'users', user.uid);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      // If phoneNumber missing and mobileNumber provided, update
      if ((userData.phoneNumber === undefined || userData.phoneNumber === null || userData.phoneNumber === '') && mobileNumber) {
        try {
          await updateDoc(userRef, { phoneNumber: mobileNumber, lastUpdatedAt: serverTimestamp() });
          userData.phoneNumber = mobileNumber;
        } catch (err) {
          console.error('Failed to update phoneNumber on existing user doc', err);
        }
      }
      // Convert Firestore Timestamps to JS Date objects
      return {
        uid: user.uid,
        email: userData.email ?? null,
        displayName: userData.displayName ?? null,
        phoneNumber: userData.phoneNumber ?? null,
        createdAt: userData.createdAt instanceof Timestamp ? userData.createdAt.toDate() : undefined,
        lastUpdatedAt: userData.lastUpdatedAt instanceof Timestamp ? userData.lastUpdatedAt.toDate() : undefined,
        pointsBalance: userData.pointsBalance ?? 0,
        role: userData.role || 'non-member',
        membershipStartDate: userData.membershipStartDate ?? null,
      } as UserDetails & { pointsBalance: number, role: string, membershipStartDate?: string | null };
    } else {
      // Create new user document
      const newUserDetails: UserDetails = {
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        phoneNumber: mobileNumber ?? user.phoneNumber ?? null,
        createdAt: new Date(), // Current date for new user
      };
      await setDoc(userRef, {
        ...newUserDetails,
        createdAt: serverTimestamp(), // Use server timestamp for initial creation
        lastUpdatedAt: serverTimestamp(),
      });
      return newUserDetails;
    }
  } catch (error) {
    console.error("Error getting or creating user document:", error);
    return null;
  }
}

/**
 * Updates specific fields in a user's Firestore document.
 * @param userId The UID of the user to update.
 * @param updates An object containing the fields to update (e.g., displayName, phoneNumber).
 * @returns A Promise that resolves when the update is complete.
 */
export async function updateFirestoreUserDetails(
  userId: string,
  updates: Partial<Pick<UserDetails, 'displayName' | 'phoneNumber'>>
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  try {
    // Ensure undefined values are converted to null or handled as per Firestore requirements
    const sanitizedUpdates: any = {};
    for (const key in updates) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        const typedKey = key as keyof typeof updates;
        sanitizedUpdates[typedKey] = updates[typedKey] === undefined ? null : updates[typedKey];
      }
    }
    await setDoc(userRef, { ...sanitizedUpdates, lastUpdatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Error updating user details in Firestore:", error);
    throw error; // Re-throw to be caught by caller
  }
}

/**
 * Fetches all bookings for a specific user.
 * Converts Firestore Timestamps to JS Date objects for bookingDate.
 * @param userId The UID of the user whose bookings to fetch.
 * @returns A Promise that resolves to an array of Booking objects.
 */
export async function getUserBookings(userId: string): Promise<Booking[]> {
  const bookingsRef = collection(db, 'bookings');
  // Query for bookings by userId and order by bookingDate descending
  const q = query(
    bookingsRef, 
    where('userId', '==', userId), 
    orderBy('bookingDate', 'desc') 
  );

  try {
    const querySnapshot = await getDocs(q);
    const bookings: Booking[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      bookings.push({
        id: docSnap.id,
        ...data,
        bookingDate: data.bookingDate instanceof Timestamp ? data.bookingDate.toDate() : new Date(), // Convert Timestamp
      } as Booking);
    });
    return bookings;
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    if ((error as any).code === 'failed-precondition' && (error as any).message.includes('index')) {
      console.warn(
        "Firestore indexing issue detected for 'bookings' collection. " +
        "Query requires a composite index on 'userId' (ASC) and 'bookingDate' (DESC). " +
        "Please create this index in your Firebase console."
      );
    }
    return []; // Return empty array on error
  }
}


/**
 * Creates a new booking document in Firestore.
 * @param user The Firebase Auth user object.
 * @param items Array of items in the booking.
 * @param totalAmount The total amount of the booking.
 * @param totalSavings The total savings from original prices.
 * @param bookingUserDetails Object containing displayName and phoneNumber for the booking.
 * @returns A Promise that resolves to the ID of the newly created booking document, or null on failure.
 */
export async function createBooking(
  user: FirebaseAuthUser,
  items: BookingItem[],
  totalAmount: number,
  totalSavings: number,
  bookingUserDetails: { displayName: string | null; phoneNumber: string | null }
): Promise<string | null> {
  if (!user) {
    console.error("User not authenticated for creating booking.");
    return null;
  }

  const bookingsRef = collection(db, 'bookings');
  
  const bookingData = {
    userId: user.uid,
    userEmail: user.email ?? null,
    userName: bookingUserDetails.displayName ?? user.displayName ?? user.email?.split('@')[0] ?? null,
    userPhone: bookingUserDetails.phoneNumber ?? user.phoneNumber ?? null,
    items: items.map(item => ({
      testId: item.testId,
      testName: item.testName,
      testImageUrl: item.testImageUrl ?? null,
      labName: item.labName,
      price: item.price,
      originalPrice: item.originalPrice ?? null,
      appointmentDateTime: item.appointmentDateTime ?? null,
    })),
    totalAmount: totalAmount,
    totalSavings: totalSavings,
    bookingDate: serverTimestamp(),
    status: 'Pending Confirmation', 
  };

  for (const item of bookingData.items) {
    if (item.testId === undefined || item.testName === undefined || item.labName === undefined || item.price === undefined) {
      console.error("Booking data contains undefined essential item fields:", item);
      throw new Error("Booking item data is incomplete. Cannot save.");
    }
  }
  if(bookingData.userId === undefined || bookingData.totalAmount === undefined || bookingData.totalSavings === undefined) {
     console.error("Booking data contains undefined essential root fields:", bookingData);
     throw new Error("Booking root data is incomplete. Cannot save.");
  }


  try {
    const docRef = await addDoc(bookingsRef, bookingData);
    return docRef.id;
  } catch (error) {
    console.error("Error creating booking in Firestore:", error);
    throw error; // Re-throw to be caught by the caller
  }
}

/**
 * Saves prescription details to Firestore.
 * @param userName User's name.
 * @param userPhone User's phone number.
 * @param imageUrl Secure URL of the uploaded image from Cloudinary.
 * @param user Optional: Logged-in Firebase user to associate the prescription with.
 * @returns A Promise that resolves to the ID of the newly created prescription document, or throws an error on failure.
 */
export async function savePrescriptionToFirestore(
  userName: string,
  userPhone: string,
  imageUrl: string,
  user: FirebaseAuthUser | null
): Promise<string> {
  try {
    const prescriptionData: {
      userName: string;
      phone: string;
      imageUrl: string;
      timestamp: any; // serverTimestamp()
      userId?: string;
      userEmail?: string | null;
      status: string;
    } = {
      userName,
      phone: userPhone,
      imageUrl,
      timestamp: serverTimestamp(),
      status: 'Pending Review', // Default status for new prescriptions
    };

    if (user) {
      prescriptionData.userId = user.uid;
      prescriptionData.userEmail = user.email ?? null;
    }

    const docRef = await addDoc(collection(db, 'prescriptions'), prescriptionData);
    return docRef.id;
  } catch (error) {
    console.error("Error saving prescription to Firestore:", error);
    throw new Error(`Failed to save prescription details: ${(error as Error).message}`);
  }
}

/**
 * Redeems wallet points for a user. Deducts points, adds a wallet transaction, and returns new balance.
 * @param userId The user's UID
 * @param pointsToRedeem Number of points to redeem (positive integer)
 * @param bookingId Optional: Booking ID for reference
 * @returns Promise<number> New points balance
 */
export async function redeemPoints(userId: string, pointsToRedeem: number, bookingId?: string): Promise<number> {
  if (!userId || !pointsToRedeem || pointsToRedeem <= 0) throw new Error('Invalid redeem request');
  // Use Firestore transaction for atomicity
  const userRef = doc(db, 'users', userId);
  const txRef = collection(db, 'walletTransactions');
  return await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error('User not found');
    const user = userSnap.data();
    if (!user) throw new Error("User data is missing.");
    const currentBalance = user.pointsBalance || 0;
    if (currentBalance < pointsToRedeem) throw new Error('Insufficient points');
    // Deduct points
    const newBalance = currentBalance - pointsToRedeem;
    transaction.update(userRef, { pointsBalance: newBalance });
    // Add wallet transaction (modular syntax)
    const newTxDocRef = doc(txRef);
    transaction.set(newTxDocRef, {
      userId,
      date: new Date(),
      action: 'redeem',
      points: -pointsToRedeem,
      status: 'completed',
      meta: bookingId ? { bookingId } : {},
    });
    return newBalance;
  });
}

/**
 * Sets the user's online status to true and updates lastActiveAt in Firestore.
 * @param userId The UID of the user.
 */
export async function setUserOnlineStatus(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { online: true, lastActiveAt: serverTimestamp() }, { merge: true });
}

/**
 * Sets the user's online status to false in Firestore.
 * @param userId The UID of the user.
 */
export async function setUserOfflineStatus(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { online: false, lastActiveAt: serverTimestamp() }, { merge: true });
}

/**
 * Updates the user's last activity timestamp in Firestore.
 * @param userId The UID of the user.
 */
export async function updateUserActivity(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { lastActiveAt: serverTimestamp() }, { merge: true });
}

/**
 * Increments the user's login count in Firestore.
 * @param userId The UID of the user.
 */
export async function incrementUserLoginCount(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  const currentCount = userSnap.exists() && typeof userSnap.data().loginCount === 'number' ? userSnap.data().loginCount : 0;
  await setDoc(userRef, { loginCount: currentCount + 1, lastLoginAt: serverTimestamp() }, { merge: true });
}

/**
 * Logs a user activity event in Firestore.
 * @param userId The UID of the user.
 * @param activityType 'page_view' | 'test_view' | 'booking_attempt' | etc.
 * @param details Object with extra info (testId, page, etc.)
 * @param userName Optional: User's display name
 * @param userEmail Optional: User's email
 */
export async function logUserActivity(userId: string, activityType: string, details: Record<string, any> = {}, userName?: string, userEmail?: string) {
  try {
    if (!userId || !activityType) return;
    
    // Create a unique document ID based on timestamp and random string
    const timestamp = new Date().getTime();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const uniqueId = `${userId}_${timestamp}_${randomStr}`;
    
    const activityRef = doc(db, 'userActivity', uniqueId);
    const data: any = {
      userId: userId || 'unknown',
      userName: userName || null,
      userEmail: userEmail || null,
      activityType: activityType || 'unknown',
      ...details,
      timestamp: serverTimestamp(),
    };
    // Ensure all fields are defined (no undefined)
    Object.keys(data).forEach(k => { if (data[k] === undefined) data[k] = null; });
    
    // Use setDoc with a specific document ID instead of addDoc
    await setDoc(activityRef, data);
  } catch (e) {
    // Never throw, just log
    console.error('Failed to log user activity:', e);
  }
}

/**
 * Subscribes to real-time updates for the 'labs' collection.
 * @param callback Function to call with the array of labs whenever data changes.
 * @returns Unsubscribe function to stop listening.
 */
export function subscribeToLabsRealtime(callback: (labs: Array<{ id: string; name: string; location?: string }>) => void) {
  const labsRef = collection(db, 'labs');
  return onSnapshot(labsRef, (snapshot) => {
    const labs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        location: data.location || '',
      };
    });
    callback(labs);
  });
}

