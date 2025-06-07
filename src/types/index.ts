import { type Timestamp } from 'firebase/firestore'; // Import Timestamp type

export interface LabPrice {
  labName: string;
  price: number; // This is the selling/discounted price
  originalPrice?: number; // Optional: For showing strike-through original price (MRP)
  memberPrice?: number; // Optional: Member price for this lab/test
  labDescription?: string; // Optional: Lab-specific description
}

export interface LabTest {
  id: string; // Unique identifier for the test, typically a slugified test name
  docId: string; // The actual Firestore document ID from the 'tests' collection
  name: string;
  description?: string; // Optional: Short description of the test
  imageUrl?: string; // Optional: URL for the test image
  prices: LabPrice[]; // Represents prices from different labs for THIS test.
  tags?: string[]; // Optional: For search, e.g., ["blood", "cbc"]
}

export interface ContactDetails {
  phone: string;
  whatsapp: string;
  whatsappMessage?: string; // Pre-filled message for WhatsApp
  address?: string;
  email?: string;
}

export interface UserDetails {
  uid: string;
  email: string | null;
  displayName: string | null; // Changed from optional to string | null
  phoneNumber: string | null; // Changed from optional to string | null
  createdAt?: Date; // Firestore Timestamp converted to JS Date
  lastUpdatedAt?: Date; // Firestore Timestamp converted to JS Date
}

// Represents an item within a booking
export interface BookingItem {
  testId: string; // This is the Firestore document ID from the 'tests' collection (same as LabTest.docId)
  testName: string;
  testImageUrl: string | null; // Explicitly string | null
  labName: string;
  price: number;
  originalPrice: number | null; // Explicitly number | null
  appointmentDateTime?: string; // ISO string for selected date and time
}

export interface Booking {
  id?: string; // Firestore document ID, populated on read
  userId: string;
  userEmail: string | null;
  userName: string | null; // Explicitly string | null
  userPhone: string | null; // Explicitly string | null
  items: BookingItem[];
  totalAmount: number;
  totalSavings: number;
  bookingDate: Date; // Firestore Timestamp converted to JS Date
  status: string;
}

export interface PromotionalBanner {
  id: string;
  title: string;
  subtitle?: string;
  iconName: string; // Name of the lucide-react icon
  linkUrl?: string; // Optional URL for the banner to link to
  imageUrl?: string; // Optional image URL for the banner background
  videoUrl?: string; // Optional video URL for the banner background
  isActive: boolean;
  order: number; // For sequencing banners
  createdAt?: Date | Timestamp; // Allow both Date and Timestamp
  lastUpdatedAt?: Date | Timestamp; // Allow both Date and Timestamp
}

// Represents a document in the 'tests' collection (main test definition)
export interface FirestoreTest {
  // No 'id' field here as it's the document ID itself.
  testName: string;
  testImageUrl?: string;
  isPopular?: boolean;
  isPackage?: boolean; // Added field for packages
  isActive?: boolean; // Added isActive field
  description?: string; // Added description field
  tags?: string[];
  createdAt?: Timestamp; // Firestore Timestamp
  lastUpdatedAt?: Timestamp; // Firestore Timestamp
}

// Represents a document in the 'testLabPrices' collection (linking test to lab with price)
export interface FirestoreTestLabPrice {
  // No 'id' field here as it's the document ID itself.
  testId: string; // Foreign key to 'tests' collection document ID
  testName: string; // Denormalized for convenience
  labId: string; // Foreign key to 'labs' collection document ID
  labName: string; // Denormalized for convenience
  price: number; // Selling price at this lab
  originalPrice?: number; // Optional MRP at this lab
  createdAt?: Timestamp; // Firestore Timestamp
  lastUpdatedAt?: Timestamp; // Firestore Timestamp
}

// CartItem in CartContext uses testDocId which is the ID from 'tests' collection
export interface CartItem {
  testDocId: string; // Firestore document ID of the test from 'tests' collection
  testName: string;
  testImageUrl?: string;
  labName: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  appointmentDateTime?: string; // ISO string for selected date and time
}
