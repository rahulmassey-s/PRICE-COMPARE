// public/admin/app.js - v3 FINAL

document.addEventListener("DOMContentLoaded", () => {
  console.log("[DEBUG] DOM loaded. Waiting for Firebase services...");

  if (!window.firebaseConfigInitializationPromise) {
    console.error("CRITICAL: firebaseConfigInitializationPromise not found on window object. firebase-config.js may have failed to load.");
    return;
  }
  
  window.firebaseConfigInitializationPromise.then(firebaseServices => {
    if (!firebaseServices.firebaseConfigLoaded) {
      console.error("Firebase config reported an error. Admin panel cannot start.");
      document.getElementById('critical-error-banner').textContent = 'CRITICAL ERROR: Firebase services failed to initialize.';
      document.getElementById('critical-error-banner').style.display = 'block';
      showLoader(false);
      return;
    }

    console.log("[DEBUG] Firebase services ready. Initializing admin panel.");

    const {
  authInstance,
  dbInstance,
      storageInstance,
  firebaseAuthFunctions,
  firebaseFirestoreFunctions,
      firebaseStorageFunctions
    } = firebaseServices;

    // ----- App State and Config -----
    const allowedAdminUIDs = ["OgrmQ6O90zStYCfbrZ3isyz1cVe2"];
    const allowedAdminEmails = ["admin@smartbharat.com"];
const CLOUDINARY_CLOUD_NAME = "dvgilt12w";
    const CLOUDINARY_UPLOAD_PRESET = "my-preset";
const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    let labsListCache = [];
    let testsListCache = [];
    let healthConcernsListCache = [];

    // --- Booking Status Options ---
    const BOOKING_STATUS_OPTIONS = [
      'Pending Confirmation',
      'Confirmed',
      'Sample Collected',
      'Completed',
      'Cancelled',
      'Rejected'
    ];

    // --- Real-time badge for new/unread bookings ---
    let bookingsUnseenCount = 0;
    const bookingsBadge = document.getElementById('bookings-badge');
    const bookingsTabButton = document.querySelector('[data-tab="manage-bookings-tab"]');

    function updateBookingsBadge(count) {
      if (bookingsBadge) {
        if (count > 0) {
          bookingsBadge.textContent = count;
          bookingsBadge.style.display = 'inline-block';
          // Make the badge red and more engaging
          bookingsBadge.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
          bookingsBadge.style.color = 'white';
          bookingsBadge.style.fontWeight = '700';
          bookingsBadge.style.fontSize = '12px';
          bookingsBadge.style.padding = '4px 8px';
          bookingsBadge.style.borderRadius = '12px';
          bookingsBadge.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.4)';
          bookingsBadge.style.animation = 'pulse 2s infinite';
          bookingsBadge.style.border = '2px solid #fff';
        } else {
          bookingsBadge.style.display = 'none';
        }
      }
    }

    // Listen for new/unread bookings (status = 'Pending Confirmation')
    const bookingsColRef = firebaseFirestoreFunctions.collection(dbInstance, 'bookings');
    firebaseFirestoreFunctions.onSnapshot(
      firebaseFirestoreFunctions.query(bookingsColRef, firebaseFirestoreFunctions.where('status', '==', 'Pending Confirmation')),
      (snapshot) => {
        bookingsUnseenCount = snapshot.size;
        updateBookingsBadge(bookingsUnseenCount);
      }
    );

    // ----- UI Element References -----
  const loaderContainer = document.getElementById("loader-container");
    const loginContainer = document.getElementById("login-container");
    const dashboardContainer = document.getElementById("dashboard-container");
    const adminUserEmailElement = document.getElementById("admin-user-email");
    const logoutButton = document.getElementById("logout-button");
    const adminLoginForm = document.getElementById("admin-login-form");
    const toastNotificationElement = document.getElementById("toast-notification");
    
    // ----- Utility Functions -----
    const showLoader = (show) => { if (loaderContainer) loaderContainer.style.display = show ? "flex" : "none"; };
    const showLoginScreen = () => {
      showLoader(false);
      if (dashboardContainer) dashboardContainer.style.display = "none";
      if (loginContainer) loginContainer.style.display = "flex";
    };
    const showToast = (message, type = "success", duration = 3000) => {
        if (!toastNotificationElement) return;
  toastNotificationElement.textContent = message;
  toastNotificationElement.className = `toast-notification show ${type}`;
        setTimeout(() => { toastNotificationElement.className = "toast-notification"; }, duration);
    };

// ----- Data Loading Functions -----
async function loadLabs() {
        const tableBody = document.getElementById("labs-table-body");
        if (!tableBody) return;
        tableBody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
        try {
            const snapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.query(firebaseFirestoreFunctions.collection(dbInstance, "labs"), firebaseFirestoreFunctions.orderBy("name")));
            labsListCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            tableBody.innerHTML = "";
            if (labsListCache.length === 0) {
                 tableBody.innerHTML = '<tr><td colspan="3">No labs found.</td></tr>';
      return;
    }
            labsListCache.forEach(lab => {
                const row = tableBody.insertRow();
                row.setAttribute('data-lab-id', lab.id); // Add lab id for edit logic
                row.insertCell(0).textContent = lab.name || 'N/A';
                row.insertCell(1).textContent = lab.location || 'N/A';
                row.insertCell(2).innerHTML = `<button class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i> Edit</button> <button class="btn btn-danger btn-sm"><i class="fas fa-trash"></i> Delete</button>`;
            });
        } catch (e) {
            console.error("Error loading labs:", e);
            tableBody.innerHTML = '<tr><td colspan="3">Error loading labs.</td></tr>';
        }
    }
    
    async function loadHealthConcernsForAdmin() {
    const tableBody = document.getElementById("health-concerns-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    try {
        const snapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.query(firebaseFirestoreFunctions.collection(dbInstance, "healthConcerns"), firebaseFirestoreFunctions.orderBy("order")));
        healthConcernsListCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tableBody.innerHTML = "";
        if (healthConcernsListCache.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">No health concerns found.</td></tr>';
      return;
    }
        healthConcernsListCache.forEach(hc => {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = hc.name || 'N/A';
            const iconCell = row.insertCell(1);
            if(hc.imageUrl) {
                iconCell.innerHTML = `<img src="${hc.imageUrl}" alt="${hc.name}" style="width: 30px; height: 30px; object-fit: cover;">`;
      } else {
                iconCell.textContent = hc.iconName || 'N/A';
            }
            row.insertCell(2).textContent = hc.order;
            row.insertCell(3).textContent = hc.isActive ? 'Yes' : 'No';
            row.insertCell(4).textContent = hc.slug || 'N/A';
            row.insertCell(5).innerHTML = `<button class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i> Edit</button> <button class="btn btn-danger btn-sm"><i class="fas fa-trash"></i> Delete</button>`;
        });
    } catch (e) {
        console.error("Error loading health concerns:", e);
        tableBody.innerHTML = '<tr><td colspan="6">Error loading health concerns.</td></tr>';
    }
  }

  async function loadTests() {
      const tableBody = document.getElementById("tests-table-body");
      if (!tableBody) return;
      tableBody.innerHTML = '<tr><td colspan="11">Loading...</td></tr>';
      try {
          const snapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.query(firebaseFirestoreFunctions.collection(dbInstance, "tests"), firebaseFirestoreFunctions.orderBy("testName")));
          testsListCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          tableBody.innerHTML = "";
          if (testsListCache.length === 0) {
              tableBody.innerHTML = '<tr><td colspan="11">No tests found.</td></tr>';
      return;
    }
          testsListCache.forEach(test => {
              const row = tableBody.insertRow();
              row.insertCell(0).textContent = test.testName || 'N/A';
              row.insertCell(1).textContent = test.description || 'N/A';
              row.insertCell(2).innerHTML = test.imageUrl ? `<img src="${test.imageUrl}" alt="Test Image" style="width: 50px; height: 50px; object-fit: cover;">` : 'No Image';
              row.insertCell(3).textContent = test.tags ? test.tags.join(', ') : 'N/A';
              row.insertCell(4).textContent = test.isPopular ? 'Yes' : 'No';
              row.insertCell(5).textContent = test.isPackage ? 'Yes' : 'No';
              row.insertCell(6).textContent = test.isActive ? 'Yes' : 'No';
              row.insertCell(7).textContent = test.bannerText || 'N/A';
              
              const healthConcernsCell = row.insertCell(8);
              let hcHtml = 'N/A';
              if (test.healthConcernSlugs && healthConcernsListCache.length > 0) {
                  hcHtml = test.healthConcernSlugs.map(slug => {
                      const concern = healthConcernsListCache.find(hc => hc.slug === slug);
                      return concern ? concern.name : slug;
                  }).join(', ');
              }
              healthConcernsCell.innerHTML = hcHtml;

              const pricesCell = row.insertCell(9);
              // Load lab prices for this test
              loadTestLabPrices(test.id, pricesCell);
              
              row.insertCell(10).innerHTML = `<button class="btn btn-secondary btn-sm" data-test-id="${test.id}"><i class="fas fa-edit"></i> Edit</button> <button class="btn btn-danger btn-sm" data-test-id="${test.id}"><i class="fas fa-trash"></i> Delete</button>`;
          });
      } catch (e) {
          console.error("Error loading tests:", e);
          tableBody.innerHTML = '<tr><td colspan="11">Error loading tests.</td></tr>';
  }
  }

  // Function to load lab prices for a specific test
  async function loadTestLabPrices(testId, pricesCell) {
    try {
      const snapshot = await firebaseFirestoreFunctions.getDocs(
        firebaseFirestoreFunctions.query(
          firebaseFirestoreFunctions.collection(dbInstance, "testLabPrices"),
          firebaseFirestoreFunctions.where("testId", "==", testId)
        )
      );
      
      const prices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (prices.length === 0) {
        pricesCell.textContent = 'No prices';
        return;
      }
      
      // Group by lab and show count
      const labCount = new Set(prices.map(p => p.labId)).size;
      const totalPrices = prices.length;
      pricesCell.textContent = `${labCount} labs, ${totalPrices} prices`;
      
    } catch (error) {
      console.error("Error loading test prices:", error);
      pricesCell.textContent = 'Error loading';
    }
  }

  // Function to delete a test
  async function deleteTest(testId) {
    try {
      // Delete the test
      await firebaseFirestoreFunctions.deleteDoc(
        firebaseFirestoreFunctions.doc(dbInstance, 'tests', testId)
      );
      
      // Delete associated testLabPrices
      const pricesSnapshot = await firebaseFirestoreFunctions.getDocs(
        firebaseFirestoreFunctions.query(
          firebaseFirestoreFunctions.collection(dbInstance, "testLabPrices"),
          firebaseFirestoreFunctions.where("testId", "==", testId)
        )
      );
      
      const deletePromises = pricesSnapshot.docs.map(doc => 
        firebaseFirestoreFunctions.deleteDoc(doc.ref)
      );
      
      await Promise.all(deletePromises);
      
      showToast('Test deleted successfully!', 'success');
      await loadTests(); // Refresh list
    } catch (err) {
      showToast('Failed to delete test: ' + err.message, 'error');
    }
  }

  // Function to load lab prices for edit modal
  async function loadTestLabPricesForEdit(testId) {
    try {
      const container = document.getElementById('lab-prices-container-edit');
      if (!container) return;
      
      container.innerHTML = '<p>Loading prices...</p>';
      
      const snapshot = await firebaseFirestoreFunctions.getDocs(
        firebaseFirestoreFunctions.query(
          firebaseFirestoreFunctions.collection(dbInstance, "testLabPrices"),
          firebaseFirestoreFunctions.where("testId", "==", testId)
        )
      );
      
      const prices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (prices.length === 0) {
        container.innerHTML = '<p>No lab prices found for this test.</p>';
        return;
      }
      
      // Get labs data for lab names
      const labsSnapshot = await firebaseFirestoreFunctions.getDocs(
        firebaseFirestoreFunctions.collection(dbInstance, "labs")
      );
      const labs = labsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const labsMap = {};
      labs.forEach(lab => labsMap[lab.id] = lab.name);
      
      // Display prices
      container.innerHTML = '';
      prices.forEach((price, index) => {
        const labName = labsMap[price.labId] || price.labName || 'Unknown Lab';
        const priceRow = document.createElement('div');
        priceRow.className = 'lab-price-row';
        priceRow.innerHTML = `
          <div class="lab-price-info">
            <strong>${labName}</strong>
            <span>₹${price.price}</span>
            ${price.originalPrice ? `<span class="original-price">₹${price.originalPrice}</span>` : ''}
            ${price.memberPrice ? `<span class="member-price">Member: ₹${price.memberPrice}</span>` : ''}
          </div>
          <div class="lab-price-actions">
            <button type="button" class="btn btn-secondary btn-sm" onclick="openLabPriceModal('edit', '${price.id}')">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button type="button" class="btn btn-danger btn-sm" onclick="deleteLabPrice('${price.id}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        `;
        container.appendChild(priceRow);
      });
      
    } catch (error) {
      console.error("Error loading test prices for edit:", error);
      const container = document.getElementById('lab-prices-container-edit');
      if (container) {
        container.innerHTML = '<p>Error loading prices.</p>';
      }
    }
  }

  // Function to delete a lab price
  window.deleteLabPrice = async function(priceId) {
    if (confirm('Are you sure you want to delete this lab price?')) {
      try {
        await firebaseFirestoreFunctions.deleteDoc(
          firebaseFirestoreFunctions.doc(dbInstance, 'testLabPrices', priceId)
        );
        showToast('Lab price deleted successfully!', 'success');
        // Reload the current test's prices
        const testId = document.getElementById('edit-test-id-modal-input').value;
        await loadTestLabPricesForEdit(testId);
      } catch (err) {
        showToast('Failed to delete lab price: ' + err.message, 'error');
      }
    }
  };

  async function loadOffers() {
      const tableBody = document.getElementById("offers-table-body");
      if (!tableBody) return;
      tableBody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
      try {
          const snapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.query(firebaseFirestoreFunctions.collection(dbInstance, "offers"), firebaseFirestoreFunctions.orderBy("endDate", "desc")));
          const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          tableBody.innerHTML = "";
          if (offers.length === 0) {
              tableBody.innerHTML = '<tr><td colspan="8">No offers found.</td></tr>';
      return;
    }
          offers.forEach(offer => {
              const row = tableBody.insertRow();
              row.insertCell(0).textContent = offer.title || 'N/A';
              const test = testsListCache.find(t => t.id === offer.testId);
              row.insertCell(1).textContent = test ? test.testName : (offer.testId || 'N/A');
              row.insertCell(2).textContent = `${offer.discountPercentage}%`;
              row.insertCell(3).textContent = offer.couponCode || 'N/A';
              row.insertCell(4).textContent = offer.startDate ? new Date(offer.startDate).toLocaleDateString() : 'N/A';
              row.insertCell(5).textContent = offer.endDate ? new Date(offer.endDate).toLocaleDateString() : 'N/A';
              row.insertCell(6).textContent = offer.isActive ? 'Yes' : 'No';
              row.insertCell(7).innerHTML = `<button class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i> Edit</button> <button class="btn btn-danger btn-sm"><i class="fas fa-trash"></i> Delete</button>`;
          });
      } catch (e) {
          console.error("Error loading offers:", e);
          tableBody.innerHTML = '<tr><td colspan="8">Error loading offers.</td></tr>';
  }
}

async function loadPrescriptions() {
      const tableBody = document.getElementById("prescriptions-table-body");
      if (!tableBody) return;
      tableBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
      try {
          const snapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.query(firebaseFirestoreFunctions.collection(dbInstance, "prescriptions"), firebaseFirestoreFunctions.orderBy("timestamp", "desc")));
          const prescriptions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          tableBody.innerHTML = "";
          if (prescriptions.length === 0) {
              tableBody.innerHTML = '<tr><td colspan="6">No prescriptions found.</td></tr>';
      return;
    }
          prescriptions.forEach(p => {
              const row = tableBody.insertRow();
              row.insertCell(0).textContent = p.userName || 'N/A';
              row.insertCell(1).textContent = p.phone || 'N/A';
              row.insertCell(2).innerHTML = p.imageUrl ? `<img src="${p.imageUrl}" alt="Prescription" style="width: 100px;">` : 'No Image';
              row.insertCell(3).textContent = p.timestamp ? p.timestamp.toDate().toLocaleString() : 'N/A';
              row.insertCell(4).textContent = p.status || 'Pending Review';
              row.insertCell(5).innerHTML = `<button class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i> Update Status</button>`;
          });
      } catch (e) {
          console.error("Error loading prescriptions:", e);
          tableBody.innerHTML = '<tr><td colspan="6">Error loading prescriptions.</td></tr>';
  }
}

async function loadUsers() {
      const tableBody = document.getElementById("users-table-body");
      if (!tableBody) return;
      tableBody.innerHTML = '<tr><td colspan="11">Loading...</td></tr>';
      try {
          const snapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.query(firebaseFirestoreFunctions.collection(dbInstance, "users"), firebaseFirestoreFunctions.orderBy("createdAt", "desc")));
          const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          tableBody.innerHTML = "";
          if (users.length === 0) {
              tableBody.innerHTML = '<tr><td colspan="11">No users found.</td></tr>';
      return;
    }
          users.forEach(user => {
              const row = tableBody.insertRow();
              row.insertCell(0).textContent = user.id;
              row.insertCell(1).textContent = user.email || 'N/A';
              row.insertCell(2).textContent = user.displayName || 'N/A';
              row.insertCell(3).textContent = user.phoneNumber || 'N/A';
              row.insertCell(4).textContent = user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A';
              row.insertCell(5).innerHTML = user.online ? '<span style="color:green;">Online</span>' : 'Offline';
              row.insertCell(6).textContent = user.lastActiveAt ? user.lastActiveAt.toDate().toLocaleString() : 'N/A';
              row.insertCell(7).textContent = user.loginCount || 0;
              row.insertCell(8).textContent = user.lastLogin ? user.lastLogin.toDate().toLocaleString() : 'N/A';
              // Member status cell with toggle button
              const memberStatusCell = row.insertCell(9);
              const currentRole = user.role || 'non-member';
              const isMember = currentRole === 'member';
              
              const toggleButton = document.createElement('button');
              toggleButton.className = `btn btn-sm ${isMember ? 'btn-warning' : 'btn-success'}`;
              toggleButton.innerHTML = `<i class="fas fa-${isMember ? 'user-times' : 'user-plus'}"></i> ${isMember ? 'Remove Member' : 'Make Member'}`;
              toggleButton.onclick = async function() {
                try {
                  const newRole = isMember ? 'non-member' : 'member';
                  await firebaseFirestoreFunctions.updateDoc(
                    firebaseFirestoreFunctions.doc(dbInstance, 'users', user.id),
                    { role: newRole }
                  );
                  showToast(`User ${isMember ? 'removed from' : 'made'} member successfully!`, 'success');
                  await loadUsers(); // Refresh the table
                } catch (err) {
                  showToast('Failed to update user role: ' + err.message, 'error');
                }
              };
              memberStatusCell.appendChild(toggleButton);
              
              // Actions cell with View Bookings button
              const actionsCell = row.insertCell(10);
              actionsCell.innerHTML = `<button class="btn btn-info btn-sm"><i class="fas fa-list-alt"></i> View Bookings</button>`;
          });
        } catch (e) {
          console.error("Error loading users:", e);
          tableBody.innerHTML = '<tr><td colspan="11">Error loading users.</td></tr>';
  }
}

async function loadAllBookings() {
      const tableBody = document.getElementById("bookings-table-body");
      if (!tableBody) return;
      
      // Show loading with better UI
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: #4a90e2;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
              <div class="loader" style="width: 20px; height: 20px; border: 2px solid #4a90e2; border-top: 2px solid transparent;"></div>
              <span>Loading bookings...</span>
            </div>
          </td>
        </tr>
      `;
      
      try {
          // Add loading timeout for better UX
          const loadingTimeout = setTimeout(() => {
              if (tableBody.innerHTML.includes('Loading bookings')) {
                  tableBody.innerHTML = `
                    <tr>
                      <td colspan="8" style="text-align: center; padding: 20px; color: #f39c12;">
                        <div>Loading is taking longer than expected...</div>
                        <div style="font-size: 0.9em; margin-top: 10px;">Please wait while we fetch your data.</div>
                      </td>
                    </tr>
                  `;
              }
          }, 3000);
          
          const snapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.query(firebaseFirestoreFunctions.collection(dbInstance, "bookings"), firebaseFirestoreFunctions.orderBy("bookingDate", "desc"), firebaseFirestoreFunctions.limit(50)));
          clearTimeout(loadingTimeout);
          
          const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          console.log('Loaded bookings:', bookings.length);
          
          if (bookings.length === 0) {
              tableBody.innerHTML = `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 40px; color: #95a5a6;">
                    <div style="font-size: 1.1em; margin-bottom: 10px;">📋 No bookings found</div>
                    <div style="font-size: 0.9em;">No bookings have been made yet.</div>
                  </td>
                </tr>
              `;
              return;
          }
          
          // Load user details for membership status - Ultra-optimized with caching
          const userIds = [...new Set(bookings.map(b => b.userId))];
          const usersMap = {};
          
          if (userIds.length > 0) {
              // Use a more efficient approach - fetch all users in one query if possible
              try {
                  // First try to get all users in one query (more efficient)
                  const usersQuery = firebaseFirestoreFunctions.query(
                      firebaseFirestoreFunctions.collection(dbInstance, "users"),
                      firebaseFirestoreFunctions.where(firebaseFirestoreFunctions.FieldPath.documentId(), "in", userIds.slice(0, 10)) // Firestore limit is 10 for 'in' queries
                  );
                  
                  const usersSnapshot = await firebaseFirestoreFunctions.getDocs(usersQuery);
                  usersSnapshot.docs.forEach(doc => {
                      usersMap[doc.id] = doc.data();
                  });
                  
                  // If we have more than 10 users, fetch the rest individually
                  if (userIds.length > 10) {
                      const remainingUserIds = userIds.slice(10);
                      const remainingPromises = remainingUserIds.map(async (userId) => {
                          try {
                              const userDoc = await firebaseFirestoreFunctions.getDoc(firebaseFirestoreFunctions.doc(dbInstance, "users", userId));
                              return userDoc.exists() ? { userId, data: userDoc.data() } : null;
                          } catch (error) {
                              console.warn(`Failed to fetch user ${userId}:`, error);
                              return null;
                          }
                      });
                      
                      const remainingResults = await Promise.all(remainingPromises);
                      remainingResults.forEach(result => {
                          if (result) {
                              usersMap[result.userId] = result.data;
                          }
                      });
                  }
              } catch (error) {
                  console.warn('Batch user fetch failed, falling back to individual fetches:', error);
                  // Fallback to individual fetches
                  const userPromises = userIds.map(async (userId) => {
                      try {
                          const userDoc = await firebaseFirestoreFunctions.getDoc(firebaseFirestoreFunctions.doc(dbInstance, "users", userId));
                          return userDoc.exists() ? { userId, data: userDoc.data() } : null;
                      } catch (error) {
                          console.warn(`Failed to fetch user ${userId}:`, error);
                          return null;
                      }
                  });
                  
                  const userResults = await Promise.all(userPromises);
                  userResults.forEach(result => {
                      if (result) {
                          usersMap[result.userId] = result.data;
                      }
                  });
              }
          }
          
          tableBody.innerHTML = "";
          
          bookings.forEach(booking => {
              try {
                  const user = usersMap[booking.userId] || {};
                  const userRole = user.role || 'non-member';
                  const isMember = userRole === 'member';
              
              const row = tableBody.insertRow();
              
              // Booking ID
              row.insertCell(0).textContent = booking.id;
              
              // User Details
              const userDetailsCell = row.insertCell(1);
              userDetailsCell.innerHTML = `
                <div style="font-weight: 600; color: #222; font-size: 14px;">${booking.userName || 'N/A'}</div>
                <div class="secondary" style="font-size: 13px; margin: 4px 0;">${booking.userEmail || 'N/A'}</div>
                <div class="secondary" style="font-size: 13px; margin: 4px 0;">${booking.userPhone || 'N/A'}</div>
                <div style="margin-top: 6px;">
                  <span class="badge ${isMember ? 'badge-member' : 'badge-status'}">${isMember ? 'Premium Member' : 'Standard Customer'}</span>
                </div>
              `;
              
              // Test Details
              const testDetailsCell = row.insertCell(2);
              const testDetails = booking.items.map(item => `
                <div style="margin-bottom: 10px; padding: 10px; background: #fff; border-radius: 6px; border-left: 4px solid #1976d2; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                  <div style="font-weight: 600; color: #222; font-size: 13px; margin-bottom: 4px;">${item.testName}</div>
                  <div class="secondary" style="font-size: 11px; font-family: monospace; background: #f1f3f6; padding: 2px 6px; border-radius: 4px;">ID: ${item.testId}</div>
                </div>
              `).join('');
              testDetailsCell.innerHTML = testDetails || '<div class="secondary" style="font-style: italic;">No tests</div>';
              
              // Lab & Timing
              const labTimingCell = row.insertCell(3);
              const labTimingDetails = booking.items.map(item => {
                  const appointmentTime = item.appointmentDateTime ? new Date(item.appointmentDateTime).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                  }) : 'Not scheduled';
                  return `
                    <div style="margin-bottom: 10px; padding: 10px; background: #fff; border-radius: 6px; border-left: 4px solid #43a047; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                      <div style="font-weight: 600; color: #222; font-size: 13px; margin-bottom: 4px;">${item.labName}</div>
                      <div class="secondary" style="font-size: 12px; background: #eaf7ef; padding: 3px 8px; border-radius: 4px;">${appointmentTime}</div>
                    </div>
                  `;
              }).join('');
              labTimingCell.innerHTML = labTimingDetails || '<div class="secondary" style="font-style: italic;">No lab info</div>';
              
              // Pricing
              const pricingCell = row.insertCell(4);
              const pricingDetails = booking.items.map(item => {
                  const originalPrice = item.originalPrice || item.price;
                  const discount = originalPrice - item.price;
                  const discountPercent = originalPrice > 0 ? Math.round((discount / originalPrice) * 100) : 0;
                  return `
                    <div style="margin-bottom: 10px; padding: 10px; background: #fff; border-radius: 6px; border-left: 4px solid #ffc107; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                      <div style="font-weight: 600; color: #222; font-size: 14px; margin-bottom: 4px;">₹${item.price}</div>
                      ${originalPrice !== item.price ? `
                        <div class="secondary" style="font-size: 12px; text-decoration: line-through; margin-bottom: 2px;">MRP: ₹${originalPrice}</div>
                        <div style="font-size: 12px; color: #43a047; font-weight: 600; background: #eaf7ef; padding: 2px 6px; border-radius: 4px;">Save: ₹${discount} (${discountPercent}%)</div>
                      ` : ''}
                    </div>
                  `;
              }).join('');
              pricingCell.innerHTML = pricingDetails || '<div class="secondary" style="font-style: italic;">No pricing info</div>';
              
              // Booking Info
              const bookingInfoCell = row.insertCell(5);
              const bookingDate = booking.bookingDate ? booking.bookingDate.toDate().toLocaleString('en-IN') : 'N/A';
              const totalMRP = booking.items.reduce((sum, item) => sum + (item.originalPrice || item.price), 0);
              const totalSavings = totalMRP - booking.totalAmount;
              bookingInfoCell.innerHTML = `
                <div style="font-weight: 600; color: #222; font-size: 13px; margin-bottom: 4px;">${bookingDate}</div>
                <div style="font-size: 12px; color: #222; margin-bottom: 3px;">Total: <span style="font-weight: 600; color: #222;">₹${booking.totalAmount}</span></div>
                ${totalSavings > 0 ? `
                  <div style="font-size: 12px; color: #43a047; font-weight: 600; background: #eaf7ef; padding: 2px 6px; border-radius: 4px; margin-bottom: 3px;">Total Savings: ₹${totalSavings}</div>
                ` : ''}
                <div class="secondary" style="font-size: 12px;">Items: <span style="font-weight: 600; color: #222;">${booking.items.length}</span></div>
              `;
              
              // Status Dropdown
              const statusCell = row.insertCell(6);
              const statusSelect = document.createElement('select');
              statusSelect.className = 'booking-status-dropdown';
              BOOKING_STATUS_OPTIONS.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                if (booking.status === opt) option.selected = true;
                statusSelect.appendChild(option);
              });
              statusSelect.addEventListener('change', async (e) => {
                const newStatus = e.target.value;
                await firebaseFirestoreFunctions.updateDoc(firebaseFirestoreFunctions.doc(dbInstance, 'bookings', booking.id), { status: newStatus });
                showToast('Booking status updated!', 'success');
                // Send notification to user
                const BACKEND_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                  ? 'http://localhost:4000' 
                  : 'https://sbhs-notification-backend.onrender.com';
                await fetch(`${BACKEND_BASE_URL}/update-booking-status`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: booking.userId, bookingId: booking.id, newStatus })
                });
                loadAllBookings();
              });
              statusCell.appendChild(statusSelect);
              
              // Actions
              const actionsCell = row.insertCell(7);
              actionsCell.innerHTML = `
                <button class="btn btn-primary btn-sm" onclick="viewBookingDetails('${booking.id}')" style="margin-bottom: 6px; font-weight: 600; padding: 6px 12px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <i class="fas fa-eye"></i> View Details
                </button>
                <br>
                <button class="btn btn-info btn-sm" onclick="updateBookingStatus('${booking.id}')" style="font-weight: 600; padding: 6px 12px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <i class="fas fa-edit"></i> Update Status
                </button>
              `;
              } catch (bookingError) {
                  console.error("Error processing booking:", booking.id, bookingError);
                  // Continue with next booking instead of failing completely
              }
          });
      } catch (e) {
          console.error("Error loading bookings:", e);
          tableBody.innerHTML = '<tr><td colspan="8">Error loading bookings.</td></tr>';
      }
}

async function loadBanners(bannerType) {
      const collectionName = bannerType === 'primary' ? 'promotionalBanners' : 'secondaryPromotionalBanners';
      const tableBody = document.getElementById(`${bannerType}-banners-table-body`);
      if (!tableBody) return;
      tableBody.innerHTML = `<tr><td colspan="8">Loading ${bannerType} banners...</td></tr>`;
      try {
          const snapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.query(firebaseFirestoreFunctions.collection(dbInstance, collectionName), firebaseFirestoreFunctions.orderBy("order")));
          const banners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          tableBody.innerHTML = "";
          if (banners.length === 0) {
              tableBody.innerHTML = `<tr><td colspan="8">No ${bannerType} banners found.</td></tr>`;
      return;
    }
          banners.forEach(banner => {
              const row = tableBody.insertRow();
              row.insertCell(0).textContent = banner.title || 'N/A';
              row.insertCell(1).textContent = banner.subtitle || 'N/A';
              row.insertCell(2).textContent = banner.iconName || 'N/A';
              row.insertCell(3).textContent = banner.linkUrl || 'N/A';
              row.insertCell(4).innerHTML = banner.imageUrl ? `<img src="${banner.imageUrl}" style="width: 100px;">` : 'No Image';
              row.insertCell(5).textContent = banner.order;
              row.insertCell(6).textContent = banner.isActive ? 'Yes' : 'No';
              row.insertCell(7).innerHTML = `<button class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i> Edit</button> <button class="btn btn-danger btn-sm"><i class="fas fa-trash"></i> Delete</button>`;
          });
      } catch (e) {
          console.error(`Error loading ${bannerType} banners:`, e);
          tableBody.innerHTML = `<tr><td colspan="8">Error loading banners.</td></tr>`;
  }
}

async function loadSiteSettings() {
      try {
          const docSnap = await firebaseFirestoreFunctions.getDoc(firebaseFirestoreFunctions.doc(dbInstance, "siteConfiguration", "main"));
          if (docSnap.exists()) {
              const settings = docSnap.data();
              document.getElementById('site-name-input').value = settings.name || '';
              document.getElementById('site-logo-url-input').value = settings.logoUrl || '';
              if(settings.logoUrl) {
                  document.getElementById('site-logo-preview-img').src = settings.logoUrl;
                  document.getElementById('site-logo-preview-img').style.display = 'block';
              }
          }
      } catch (e) {
          console.error("Error loading site settings:", e);
          showToast("Could not load site settings.", "error");
      }
  }

async function loadUserWallets() {
    const tableBody = document.getElementById("wallets-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
    try {
        // Load all users
        const usersSnapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.collection(dbInstance, "users"));
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const usersMap = {};
        users.forEach(user => {
            usersMap[user.id] = user;
        });

        // Load all wallet transactions
        const snapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.collection(dbInstance, "walletTransactions"));
        const wallets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Group transactions by user to get current balance
        const userBalances = {};
        const userLastTransaction = {};
        wallets.forEach(wallet => {
            if (!userBalances[wallet.userId]) userBalances[wallet.userId] = 0;
            
            // Handle both old format (type: 'add'/'deduct') and new format (action: 'redeem', etc.)
            if (wallet.type === 'add') {
                userBalances[wallet.userId] += wallet.points || 0;
            } else if (wallet.type === 'deduct') {
                userBalances[wallet.userId] -= wallet.points || 0;
            } else if (wallet.action) {
                // New format: action-based transactions
                if (wallet.action === 'redeem' || wallet.action === 'manual-deduct') {
                    // Redeem transactions have negative points, so we add them (subtract from balance)
                    userBalances[wallet.userId] += wallet.points || 0;
                } else if (wallet.action === 'earn' || wallet.action === 'referral' || wallet.action === 'referral-share' || wallet.action === 'manual-add') {
                    // Earn transactions have positive points
                    userBalances[wallet.userId] += wallet.points || 0;
                }
            }
            
            // Track latest transaction for last updated
            if (!userLastTransaction[wallet.userId] || (wallet.date && wallet.date.seconds > (userLastTransaction[wallet.userId]?.date?.seconds || 0))) {
                userLastTransaction[wallet.userId] = wallet;
            }
        });

        tableBody.innerHTML = '';
        users.forEach(user => {
            // Use actual user balance from users collection, fallback to calculated balance
            const actualBalance = user.pointsBalance || 0;
            const calculatedBalance = userBalances[user.id] || 0;
            const balance = actualBalance; // Use actual balance from user document
            const latestTransaction = userLastTransaction[user.id];
            const row = tableBody.insertRow();
            row.setAttribute('data-user-id', user.id);
            row.insertCell(0).textContent = latestTransaction?.id || 'N/A';
            row.insertCell(1).textContent = user.id;
            row.insertCell(2).textContent = user?.displayName || user?.email || 'N/A';
            row.insertCell(3).textContent = user?.email || 'N/A';
            row.insertCell(4).textContent = user?.phoneNumber || 'N/A';
            row.insertCell(5).textContent = balance;
            row.insertCell(6).textContent = latestTransaction?.date ? new Date(latestTransaction.date.seconds * 1000).toLocaleString() : 'N/A';
            // Actions cell with manage points and view transactions buttons
            const actionsCell = row.insertCell(7);
            
            // Manage Points button
            const manageButton = document.createElement('button');
            manageButton.className = 'btn btn-primary btn-sm';
            manageButton.style.marginRight = '5px';
            manageButton.innerHTML = '<i class="fas fa-edit"></i> Manage Points';
            manageButton.onclick = function() {
                openWalletPointsModal(user.id, user, balance);
            };
            actionsCell.appendChild(manageButton);
            
            // View Transactions button
            const viewTransactionsButton = document.createElement('button');
            viewTransactionsButton.className = 'btn btn-secondary btn-sm';
            viewTransactionsButton.innerHTML = '<i class="fas fa-history"></i> View Transactions';
            viewTransactionsButton.onclick = function() {
                openWalletTransactionHistoryModal(user.id, user, balance);
            };
            actionsCell.appendChild(viewTransactionsButton);
        });
    } catch (error) {
        console.error("Error loading user wallets:", error);
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:red;">Error loading wallets. Check console.</td></tr>';
    }
}

async function loadUserActivity() {
    const container = document.getElementById("user-activity-content");
    if (!container) return;
    container.innerHTML = '<div>Loading user activity...</div>';
    try {
        const snapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.query(firebaseFirestoreFunctions.collection(dbInstance, "userActivity"), firebaseFirestoreFunctions.orderBy("timestamp", "desc"), firebaseFirestoreFunctions.limit(100)));
        const activities = snapshot.docs.map(doc => doc.data());
        
        if (activities.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 1rem;">No user activity found.</div>';
        } else {
            container.innerHTML = activities.map(act => `
                <div class="activity-item">
                    <p><strong>User:</strong> ${act.userId || 'N/A'}</p>
                    <p><strong>Action:</strong> ${act.action || 'N/A'}</p>
                    <p><strong>Timestamp:</strong> ${act.timestamp ? new Date(act.timestamp.seconds * 1000).toLocaleString() : 'N/A'}</p>
                    ${act.details ? `<pre>${JSON.stringify(act.details, null, 2)}</pre>` : ''}
                </div>
            `).join('');
        }
  } catch (error) {
        console.error("Error loading user activity:", error);
        container.innerHTML = '<div style="text-align:center;color:red;">Error loading activity. Check console.</div>';
    }
}

async function loadCrmDashboardData() {
    try {
        // Load summary cards
        const usersSnapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.collection(dbInstance, 'users'));
        document.getElementById('total-users').textContent = usersSnapshot.size;

        const bookingsSnapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.collection(dbInstance, 'bookings'));
        document.getElementById('total-bookings').textContent = bookingsSnapshot.size;

        const labsSnapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.collection(dbInstance, 'labs'));
        document.getElementById('total-labs').textContent = labsSnapshot.size;

        const testsSnapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.collection(dbInstance, 'lab_tests'));
        document.getElementById('total-tests').textContent = testsSnapshot.size;

        // --- Chart Generation (FINAL - CORRECTED) ---
        const chartCanvas = document.getElementById('bookings-chart');
        if (!chartCanvas) return;
        const chartContainer = chartCanvas.parentElement;

        const allBookingsSnapshot = await firebaseFirestoreFunctions.getDocs(
            firebaseFirestoreFunctions.collection(dbInstance, 'bookings')
        );

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const bookingsByDay = {};
        allBookingsSnapshot.forEach(doc => {
        const booking = doc.data();
            let bookingDate = null;

            // Using 'bookingDate' as confirmed by diagnostics
            if (booking.bookingDate && typeof booking.bookingDate.toDate === 'function') {
                bookingDate = booking.bookingDate.toDate();
            }

            if (bookingDate && bookingDate >= thirtyDaysAgo) {
                const dateKey = bookingDate.toISOString().split('T')[0];
                bookingsByDay[dateKey] = (bookingsByDay[dateKey] || 0) + 1;
            }
        });

        const sortedDays = Object.keys(bookingsByDay).sort();
        
        if (sortedDays.length === 0) {
            chartContainer.innerHTML = '<p style="text-align: center; padding: 2rem;">No booking data available for the last 30 days.</p>';
    return;
  }

        const chartLabels = sortedDays.map(day => new Date(day).toLocaleDateString('en-GB'));
        const chartData = sortedDays.map(day => bookingsByDay[day]);

        const ctx = chartCanvas.getContext('2d');
        if (ctx) {
            // Destroy existing chart instance if it exists
            if (window.bookingsChart instanceof Chart) {
                window.bookingsChart.destroy();
            }
            window.bookingsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: 'Bookings per Day (Last 30 Days)',
                        data: chartData,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                }
            });
        }
  } catch (error) {
        console.error("Error loading CRM dashboard data:", error);
        document.getElementById('bookings-chart').parentElement.innerHTML = '<p style="text-align:center;color:red;">Error loading chart data.</p>';
    }
}

    // ----- Main Initialization Logic -----
    
    async function showDashboardUI(user) {
        if (adminUserEmailElement) adminUserEmailElement.textContent = user.email;
        showLoader(false);
        if(loginContainer) loginContainer.style.display = "none";
        if(dashboardContainer) dashboardContainer.style.display = "flex";
        
        // Load labs on initial dashboard view
        await loadLabs();
    }

    function initializeAppEventListeners() {
        if (adminLoginForm) {
            adminLoginForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const email = document.getElementById("admin-email").value;
                const password = document.getElementById("admin-password").value;
                try {
                    await firebaseAuthFunctions.signInWithEmailAndPassword(authInstance, email, password);
  } catch (error) {
                    showToast(`Login Failed: ${error.message}`, "error");
                }
            });
        }

        if (logoutButton) {
            logoutButton.addEventListener("click", () => {
                firebaseAuthFunctions.signOut(authInstance);
            });
        }
        
        const tabButtons = document.querySelectorAll(".sidebar .tab-button");
        tabButtons.forEach(button => {
    button.addEventListener("click", () => {
                const tabId = button.dataset.tab;
                if (!tabId) return;
                
                document.querySelectorAll(".main-content .tab-content").forEach(c => c.classList.remove('active'));
                document.getElementById(tabId)?.classList.add('active');
                
                tabButtons.forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                
                // Add lazy loading for other tabs here if needed
                if (tabId === 'manage-tests-tab' && !document.getElementById(tabId)?.dataset.loaded) {
    loadTests();
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
                if (tabId === 'manage-health-concerns-tab' && !document.getElementById(tabId)?.dataset.loaded) {
    loadHealthConcernsForAdmin();
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
                if (tabId === 'manage-offers-tab' && !document.getElementById(tabId)?.dataset.loaded) {
    loadOffers();
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
                if (tabId === 'view-prescriptions-tab' && !document.getElementById(tabId)?.dataset.loaded) {
                    loadPrescriptions();
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
                if (tabId === 'manage-users-tab' && !document.getElementById(tabId)?.dataset.loaded) {
                    loadUsers();
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
                if (tabId === 'manage-bookings-tab' && !document.getElementById(tabId)?.dataset.loaded) {
                    loadAllBookings();
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
                if (tabId === 'manage-banners-tab' && !document.getElementById(tabId)?.dataset.loaded) {
                    loadBanners('primary');
                    loadBanners('secondary');
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
                if (tabId === 'site-settings-tab' && !document.getElementById(tabId)?.dataset.loaded) {
                    loadSiteSettings();
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
                if (tabId === 'wallet-accounts-tab' && !document.getElementById(tabId)?.dataset.loaded) {
                    loadUserWallets();
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
                if (tabId === 'user-activity-tab' && !document.getElementById(tabId)?.dataset.loaded) {
                    loadUserActivity();
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
                if (tabId === 'crm-dashboard-tab' && !document.getElementById(tabId)?.dataset.loaded) {
                    loadCrmDashboardData();
                    document.getElementById(tabId).dataset.loaded = 'true';
                }
            });
        });
    }

    // ----- Edit Lab Modal logic (ENSURED AT END OF PROMISE BLOCK) -----
  const editLabModal = document.getElementById('editLabModal');
  const editLabForm = document.getElementById('editLabForm');
  const editLabNameInput = document.getElementById('editLabName');
  const editLabLocationInput = document.getElementById('editLabLocation');
  const editLabRowIndexInput = document.getElementById('editLabRowIndex');
  const cancelEditLabBtn = document.getElementById('cancelEditLabBtn');

  document.addEventListener('click', async function(e) {
    // Handle Edit buttons
    if (e.target && e.target.closest('.btn-secondary') && e.target.closest('.btn-secondary').textContent.includes('Edit')) {
      console.log('[DEBUG] Edit button clicked');
      const row = e.target.closest('tr');
      const tableBody = e.target.closest('tbody');
      
      // Handle lab edit buttons (from labs table)
      if (row && tableBody && tableBody.id === 'labs-table-body') {
        const labName = row.querySelector('td') ? row.querySelector('td').textContent : '';
        const locationCell = row.querySelectorAll('td')[1];
        const labLocation = locationCell ? locationCell.textContent : '';
        const rowIndex = Array.from(row.parentNode.children).indexOf(row);
        editLabNameInput.value = labName;
        editLabLocationInput.value = labLocation;
        editLabRowIndexInput.value = rowIndex;
        editLabModal.style.display = 'flex';
      }
      
      // Handle health concern edit buttons (from health concerns table)
      if (row && tableBody && tableBody.id === 'health-concerns-table-body') {
        const concernName = row.querySelector('td') ? row.querySelector('td').textContent : '';
        const concern = healthConcernsListCache.find(hc => hc.name === concernName);
        if (concern) {
          const editHcModal = document.getElementById('edit-health-concern-modal');
          const editHcIdInput = document.getElementById('edit-hc-id-modal-input');
          const editHcNameInput = document.getElementById('edit-hc-name-modal-input');
          const editHcOrderInput = document.getElementById('edit-hc-order-modal-input');
          const editHcIconNameInput = document.getElementById('edit-hc-icon-name-modal-input');
          const editHcIconUrlInput = document.getElementById('edit-hc-icon-url-modal-input');
          const editHcIsActiveInput = document.getElementById('edit-hc-is-active-modal-input');
          
          editHcIdInput.value = concern.id;
          editHcNameInput.value = concern.name || '';
          editHcOrderInput.value = concern.order || 0;
          editHcIconNameInput.value = concern.iconName || '';
          editHcIconUrlInput.value = concern.imageUrl || '';
          editHcIsActiveInput.checked = concern.isActive !== false;
          
          editHcModal.style.display = 'flex';
        }
      }
      
      // Handle test edit buttons (from tests table)
      if (row && tableBody && tableBody.id === 'tests-table-body') {
        const testId = e.target.closest('button').getAttribute('data-test-id');
        const test = testsListCache.find(t => t.id === testId);
        if (test) {
          const editTestModal = document.getElementById('edit-test-modal');
          const editTestIdInput = document.getElementById('edit-test-id-modal-input');
          const editTestNameInput = document.getElementById('edit-test-name-modal-input');
          const editTestDescriptionInput = document.getElementById('edit-test-description-modal-input');
          const editTestImageUrlInput = document.getElementById('edit-test-image-url-modal-input');
          const editTestTagsInput = document.getElementById('edit-test-tags-modal-input');
          const editTestIsPopularInput = document.getElementById('edit-test-is-popular-modal-input');
          const editTestIsPackageInput = document.getElementById('edit-test-is-package-modal-input');
          const editTestIsActiveInput = document.getElementById('edit-test-is-active-modal-input');
          const editTestBannerTextInput = document.getElementById('edit-test-banner-text-modal-input');
          
          editTestIdInput.value = test.id;
          editTestNameInput.value = test.testName || '';
          editTestDescriptionInput.value = test.description || '';
          editTestImageUrlInput.value = test.imageUrl || '';
          editTestTagsInput.value = test.tags ? test.tags.join(', ') : '';
          editTestIsPopularInput.checked = test.isPopular === true;
          editTestIsPackageInput.checked = test.isPackage === true;
          editTestIsActiveInput.checked = test.isActive !== false;
          editTestBannerTextInput.value = test.bannerText || '';
          
          // Load existing lab prices for this test
          await loadTestLabPricesForEdit(test.id);

          // Populate health concerns checkboxes
          const healthConcernsContainer = document.getElementById('health-concerns-checkboxes-edit');
          healthConcernsContainer.innerHTML = '';
          const selectedSlugs = Array.isArray(test.healthConcernSlugs) ? test.healthConcernSlugs : [];
          healthConcernsListCache.forEach(hc => {
            const checkboxId = `edit-hc-checkbox-${hc.slug}`;
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
              <input type="checkbox" id="${checkboxId}" value="${hc.slug}" ${selectedSlugs.includes(hc.slug) ? 'checked' : ''}>
              <label for="${checkboxId}">${hc.name}</label>
            `;
            healthConcernsContainer.appendChild(div);
          });
          
          editTestModal.style.display = 'flex';
        }
      }
    }
    
    // Handle Delete buttons
    if (e.target && e.target.closest('.btn-danger') && e.target.closest('.btn-danger').textContent.includes('Delete')) {
      console.log('[DEBUG] Delete button clicked');
      const row = e.target.closest('tr');
      const tableBody = e.target.closest('tbody');
      
      // Handle test delete buttons (from tests table)
      if (row && tableBody && tableBody.id === 'tests-table-body') {
        const testId = e.target.closest('button').getAttribute('data-test-id');
        const test = testsListCache.find(t => t.id === testId);
        if (test && confirm(`Are you sure you want to delete the test "${test.testName}"?`)) {
          deleteTest(testId);
        }
      }
    }
  });

  cancelEditLabBtn.addEventListener('click', function() {
    editLabModal.style.display = 'none';
  });

  editLabForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = editLabNameInput.value.trim();
    const location = editLabLocationInput.value.trim();
    const rowIndex = parseInt(editLabRowIndexInput.value, 10);
    let labId = null;
    const tableBody = document.getElementById('labs-table-body');
    if (!isNaN(rowIndex) && tableBody && tableBody.rows[rowIndex]) {
      labId = tableBody.rows[rowIndex].getAttribute('data-lab-id');
    }
    let oldLabName = null;
    if (!isNaN(rowIndex) && tableBody && tableBody.rows[rowIndex]) {
      oldLabName = tableBody.rows[rowIndex].cells[0].textContent.trim();
    }
    if (labId) {
      try {
        await firebaseFirestoreFunctions.updateDoc(
          firebaseFirestoreFunctions.doc(dbInstance, 'labs', labId),
          { name, location }
        );
        // Call backend to update testLabPrices labName
        if (oldLabName && name && oldLabName !== name) {
          try {
            const resp = await fetch('http://localhost:4000/update-lab-name', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ oldLabName, newLabName: name })
            });
            const data = await resp.json();
            showToast(`Lab name updated in test cards (${data.updated} prices updated)`, 'success');
          } catch (err) {
            showToast('Lab name updated, but failed to update test cards', 'error');
          }
        }
        await loadLabs(); // Refresh list
      } catch (err) {
        alert('Failed to update lab: ' + err.message);
      }
    }
    editLabModal.style.display = 'none';
  });

  // ----- Health Concern Edit Modal logic -----
  const editHcModal = document.getElementById('edit-health-concern-modal');
  const editHcForm = document.getElementById('edit-health-concern-form-modal');
  const closeHcModalBtn = editHcModal ? editHcModal.querySelector('.close-modal-btn') : null;

  if (closeHcModalBtn) {
    closeHcModalBtn.addEventListener('click', function() {
      editHcModal.style.display = 'none';
    });
  }

  // Close modal when clicking outside
  if (editHcModal) {
    editHcModal.addEventListener('click', function(e) {
      if (e.target === editHcModal) {
        editHcModal.style.display = 'none';
      }
    });
  }

  if (editHcForm) {
    editHcForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const concernId = document.getElementById('edit-hc-id-modal-input').value;
      const name = document.getElementById('edit-hc-name-modal-input').value.trim();
      const order = parseInt(document.getElementById('edit-hc-order-modal-input').value, 10);
      const iconName = document.getElementById('edit-hc-icon-name-modal-input').value;
      const imageUrl = document.getElementById('edit-hc-icon-url-modal-input').value.trim();
      const isActive = document.getElementById('edit-hc-is-active-modal-input').checked;
      
      if (concernId) {
        try {
          await firebaseFirestoreFunctions.updateDoc(
            firebaseFirestoreFunctions.doc(dbInstance, 'healthConcerns', concernId),
            { 
              name, 
              order, 
              iconName, 
              imageUrl: imageUrl || null,
              isActive,
              slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
            }
          );
          showToast('Health concern updated successfully!', 'success');
          await loadHealthConcernsForAdmin(); // Refresh list
        } catch (err) {
          showToast('Failed to update health concern: ' + err.message, 'error');
        }
      }
      editHcModal.style.display = 'none';
    });
  }

  // ----- Test Edit Modal logic -----
  const editTestModal = document.getElementById('edit-test-modal');
  const editTestForm = document.getElementById('edit-test-form-modal');
  const closeTestModalBtn = editTestModal ? editTestModal.querySelector('.close-modal-btn') : null;

  if (closeTestModalBtn) {
    closeTestModalBtn.addEventListener('click', function() {
      editTestModal.style.display = 'none';
    });
  }

  // Close modal when clicking outside
  if (editTestModal) {
    editTestModal.addEventListener('click', function(e) {
      if (e.target === editTestModal) {
        editTestModal.style.display = 'none';
      }
    });
  }

  // Add Lab Price button functionality
  const addLabPriceBtn = document.getElementById('add-lab-price-row-btn-edit');
  if (addLabPriceBtn) {
    addLabPriceBtn.addEventListener('click', function() {
      openLabPriceModal('add');
    });
  }

  // 2. Modal open logic
  window.openLabPriceModal = async function(mode, priceId = null) {
    const modal = document.getElementById('lab-price-modal');
    const form = document.getElementById('lab-price-form');
    const title = document.getElementById('lab-price-modal-title');
    const labSelect = document.getElementById('lab-select');
    const priceInput = document.getElementById('lab-price-input');
    const originalPriceInput = document.getElementById('lab-original-price-input');
    const memberPriceInput = document.getElementById('lab-member-price-input');
    const priceIdInput = document.getElementById('lab-price-id-input');
    // Populate labs dropdown
    labSelect.innerHTML = '';
    const labsSnapshot = await firebaseFirestoreFunctions.getDocs(firebaseFirestoreFunctions.collection(dbInstance, "labs"));
    const labs = labsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    labs.forEach(lab => {
      const option = document.createElement('option');
      option.value = lab.id;
      option.textContent = lab.name;
      labSelect.appendChild(option);
    });
    if (mode === 'edit' && priceId) {
      title.textContent = 'Edit Lab Price';
      // Fetch price data
      const doc = await firebaseFirestoreFunctions.getDoc(firebaseFirestoreFunctions.doc(dbInstance, "testLabPrices", priceId));
      const data = doc.data();
      labSelect.value = data.labId;
      labSelect.disabled = true;
      priceInput.value = data.price || '';
      originalPriceInput.value = data.originalPrice || '';
      memberPriceInput.value = data.memberPrice || '';
      priceIdInput.value = priceId;
    } else {
      title.textContent = 'Add Lab Price';
      labSelect.disabled = false;
      labSelect.selectedIndex = 0;
      priceInput.value = '';
      originalPriceInput.value = '';
      memberPriceInput.value = '';
      priceIdInput.value = '';
    }
    modal.style.display = 'flex';
  };

  // 3. Modal close logic
  const closeLabPriceModalBtn = document.getElementById('close-lab-price-modal');
  if (closeLabPriceModalBtn) {
    closeLabPriceModalBtn.onclick = function() {
      document.getElementById('lab-price-modal').style.display = 'none';
    };
  }

  // 4. Modal save handler
  const labPriceForm = document.getElementById('lab-price-form');
  if (labPriceForm) {
    labPriceForm.onsubmit = async function(e) {
      e.preventDefault();
      const testId = document.getElementById('edit-test-id-modal-input').value;
      const labId = document.getElementById('lab-select').value;
      const price = parseFloat(document.getElementById('lab-price-input').value);
      const originalPrice = parseFloat(document.getElementById('lab-original-price-input').value) || null;
      const memberPrice = parseFloat(document.getElementById('lab-member-price-input').value) || null;
      const priceId = document.getElementById('lab-price-id-input').value;
      const labName = document.getElementById('lab-select').selectedOptions[0].textContent;
      if (!testId || !labId || isNaN(price)) {
        showToast('Please fill all required fields', 'error');
        return;
      }
      try {
        if (priceId) {
          // Edit
          await firebaseFirestoreFunctions.updateDoc(
            firebaseFirestoreFunctions.doc(dbInstance, "testLabPrices", priceId),
            { price, originalPrice, memberPrice }
          );
          showToast('Lab price updated!', 'success');
        } else {
          // Add
          await firebaseFirestoreFunctions.addDoc(
            firebaseFirestoreFunctions.collection(dbInstance, "testLabPrices"),
            { testId, labId, labName, price, originalPrice, memberPrice, createdAt: firebaseFirestoreFunctions.serverTimestamp() }
          );
          showToast('Lab price added!', 'success');
        }
        document.getElementById('lab-price-modal').style.display = 'none';
        await loadTestLabPricesForEdit(testId);
      } catch (err) {
        showToast('Error saving lab price: ' + err.message, 'error');
      }
    };
  }

  if (editTestForm) {
    editTestForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const testId = document.getElementById('edit-test-id-modal-input').value;
      const testName = document.getElementById('edit-test-name-modal-input').value.trim();
      const description = document.getElementById('edit-test-description-modal-input').value.trim();
      const imageUrl = document.getElementById('edit-test-image-url-modal-input').value.trim();
      const tags = document.getElementById('edit-test-tags-modal-input').value.split(',').map(tag => tag.trim()).filter(tag => tag);
      const isPopular = document.getElementById('edit-test-is-popular-modal-input').checked;
      const isPackage = document.getElementById('edit-test-is-package-modal-input').checked;
      const isActive = document.getElementById('edit-test-is-active-modal-input').checked;
      const bannerText = document.getElementById('edit-test-banner-text-modal-input').value.trim();
      
      const selectedHealthConcernSlugs = Array.from(document.querySelectorAll('#health-concerns-checkboxes-edit input[type=checkbox]:checked')).map(cb => cb.value);

      if (testId) {
        try {
          await firebaseFirestoreFunctions.updateDoc(
            firebaseFirestoreFunctions.doc(dbInstance, 'tests', testId),
            { 
              testName, 
              description, 
              imageUrl: imageUrl || null,
              tags,
              isPopular,
              isPackage,
              isActive,
              bannerText: bannerText || null,
              healthConcernSlugs: selectedHealthConcernSlugs
            }
          );
          showToast('Test updated successfully!', 'success');
          await loadTests(); // Refresh list
        } catch (err) {
          showToast('Failed to update test: ' + err.message, 'error');
        }
      }
      editTestModal.style.display = 'none';
    });
  }

  // Add test form submission handler
  const addTestForm = document.getElementById('add-test-form');
  if (addTestForm) {
    addTestForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const testName = document.getElementById('test-name-input').value.trim();
      const description = document.getElementById('test-description-input').value.trim();
      const imageUrl = document.getElementById('test-image-url-input').value.trim();
      const tags = document.getElementById('test-tags-input').value.split(',').map(tag => tag.trim()).filter(tag => tag);
      const isPopular = document.getElementById('test-is-popular-input').checked;
      const isPackage = document.getElementById('test-is-package-input').checked;
      const isActive = document.getElementById('test-is-active-input').checked;
      const bannerText = document.getElementById('test-banner-text-input').value.trim();
      
      const selectedHealthConcernSlugs = Array.from(document.querySelectorAll('#health-concerns-checkboxes-add input[type=checkbox]:checked')).map(cb => cb.value);

      if (!testName) {
        showToast('Test name is required', 'error');
        return;
      }

      try {
        const testData = {
          testName,
          description: description || null,
          imageUrl: imageUrl || null,
          tags,
          isPopular,
          isPackage,
          isActive,
          bannerText: bannerText || null,
          healthConcernSlugs: selectedHealthConcernSlugs,
          createdAt: firebaseFirestoreFunctions.serverTimestamp()
        };

        const docRef = await firebaseFirestoreFunctions.addDoc(
          firebaseFirestoreFunctions.collection(dbInstance, 'tests'),
          testData
        );

        // Add lab prices if any are specified
        const labPricesContainer = document.getElementById('lab-prices-container-add');
        const labPriceRows = labPricesContainer.querySelectorAll('.lab-price-row');
        
        for (const row of labPriceRows) {
          const labSelect = row.querySelector('select');
          const priceInput = row.querySelector('input[type="number"]');
          const originalPriceInput = row.querySelector('input[placeholder*="Original"]');
          const memberPriceInput = row.querySelector('input[placeholder*="Member"]');
          
          if (labSelect && labSelect.value && priceInput && priceInput.value) {
            const labId = labSelect.value;
            const labName = labSelect.selectedOptions[0].textContent;
            const price = parseFloat(priceInput.value);
            const originalPrice = originalPriceInput ? parseFloat(originalPriceInput.value) || null : null;
            const memberPrice = memberPriceInput ? parseFloat(memberPriceInput.value) || null : null;

            await firebaseFirestoreFunctions.addDoc(
              firebaseFirestoreFunctions.collection(dbInstance, "testLabPrices"),
              { 
                testId: docRef.id, 
                labId, 
                labName, 
                price, 
                originalPrice, 
                memberPrice, 
                createdAt: firebaseFirestoreFunctions.serverTimestamp() 
              }
            );
          }
        }

        showToast('Test added successfully!', 'success');
        addTestForm.reset();
        
        // Clear lab prices container
        const labPricesContainerToClear = document.getElementById('lab-prices-container-add');
        labPricesContainerToClear.innerHTML = '';
        
        // Refresh tests list
        await loadTests();
      } catch (err) {
        showToast('Failed to add test: ' + err.message, 'error');
      }
    });
  }

  // Function to load health concerns for add form
  async function loadHealthConcernsForAddForm() {
    const healthConcernsContainer = document.getElementById('health-concerns-checkboxes-add');
    if (!healthConcernsContainer) return;
    
    healthConcernsContainer.innerHTML = '<p>Loading health concerns...</p>';
    
    try {
      if (healthConcernsListCache.length === 0) {
        const snapshot = await firebaseFirestoreFunctions.getDocs(
          firebaseFirestoreFunctions.query(
            firebaseFirestoreFunctions.collection(dbInstance, "healthConcerns"), 
            firebaseFirestoreFunctions.orderBy("order")
          )
        );
        healthConcernsListCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      healthConcernsContainer.innerHTML = '';
      healthConcernsListCache.forEach(hc => {
        const checkboxId = `add-hc-checkbox-${hc.slug}`;
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `
          <input type="checkbox" id="${checkboxId}" value="${hc.slug}">
          <label for="${checkboxId}">${hc.name}</label>
        `;
        healthConcernsContainer.appendChild(div);
      });
    } catch (e) {
      console.error("Error loading health concerns for add form:", e);
      healthConcernsContainer.innerHTML = '<p>Error loading health concerns.</p>';
    }
  }

  // Load health concerns when manage tests tab is opened
  const manageTestsTab = document.getElementById('manage-tests-tab');
  if (manageTestsTab) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (manageTestsTab.classList.contains('active')) {
            loadHealthConcernsForAddForm();
            observer.disconnect(); // Only load once
          }
        }
      });
    });
    
    observer.observe(manageTestsTab, { attributes: true });
  }

  // Wallet Points Modal Functions
  window.openWalletPointsModal = function(userId, user, currentBalance) {
    const modal = document.getElementById('wallet-points-modal');
    const userNameInput = document.getElementById('wallet-user-name');
    const userIdInput = document.getElementById('wallet-user-id');
    const balanceInput = document.getElementById('wallet-current-balance');
    const userEmailInput = document.getElementById('wallet-user-email');
    
    userNameInput.value = user?.displayName || user?.email || 'N/A';
    userIdInput.value = userId;
    balanceInput.value = currentBalance;
    userEmailInput.value = user?.email || '';
    
    // Reset form
    document.getElementById('wallet-action-type').value = 'add';
    document.getElementById('wallet-points-amount').value = '';
    document.getElementById('wallet-reason').value = '';
    
    modal.style.display = 'flex';
  };

  // Wallet Transaction History Modal Functions
  window.openWalletTransactionHistoryModal = async function(userId, user, currentBalance) {
    const modal = document.getElementById('wallet-transaction-history-modal');
    const userNameElement = document.getElementById('transaction-history-user-name');
    const userEmailElement = document.getElementById('transaction-history-user-email');
    const currentBalanceElement = document.getElementById('transaction-history-current-balance');
    const tableBody = document.getElementById('wallet-transaction-history-table-body');
    
    // Set user info
    userNameElement.textContent = `User: ${user?.displayName || user?.email || 'N/A'}`;
    userEmailElement.textContent = `Email: ${user?.email || 'N/A'}`;
    currentBalanceElement.textContent = `Current Balance: ${currentBalance} points`;
    
    // Show loading
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading transactions...</td></tr>';
    modal.style.display = 'flex';
    
    try {
      // Load user's transactions
      const snapshot = await firebaseFirestoreFunctions.getDocs(
        firebaseFirestoreFunctions.query(
          firebaseFirestoreFunctions.collection(dbInstance, "walletTransactions"),
          firebaseFirestoreFunctions.where("userId", "==", userId),
          firebaseFirestoreFunctions.orderBy("date", "desc")
        )
      );
      
      const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#666;">No transactions found.</td></tr>';
        return;
      }
      
      tableBody.innerHTML = '';
      transactions.forEach(tx => {
        const row = tableBody.insertRow();
        
        // Date
        const dateCell = row.insertCell(0);
        if (tx.date && tx.date.toDate) {
          dateCell.textContent = tx.date.toDate().toLocaleString();
        } else if (tx.date && tx.date.seconds) {
          dateCell.textContent = new Date(tx.date.seconds * 1000).toLocaleString();
        } else {
          dateCell.textContent = 'N/A';
        }
        
        // Action
        const actionCell = row.insertCell(1);
        let actionText = tx.action || tx.type || 'Unknown';
        if (tx.action === 'redeem') actionText = 'Redeem';
        else if (tx.action === 'earn') actionText = 'Earn';
        else if (tx.action === 'referral-share') actionText = 'Referral Share';
        else if (tx.action === 'manual-add') actionText = 'Manual Add';
        else if (tx.type === 'add') actionText = 'Add';
        else if (tx.type === 'deduct') actionText = 'Deduct';
        actionCell.textContent = actionText;
        
        // Points
        const pointsCell = row.insertCell(2);
        const points = tx.points || 0;
        pointsCell.textContent = points > 0 ? `+${points}` : points.toString();
        pointsCell.style.color = points > 0 ? '#28a745' : '#dc3545';
        pointsCell.style.fontWeight = 'bold';
        
        // Status
        const statusCell = row.insertCell(3);
        const status = tx.status || 'completed';
        statusCell.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        statusCell.style.color = status === 'completed' ? '#28a745' : '#ffc107';
        
        // Details
        const detailsCell = row.insertCell(4);
        let details = '';
        if (tx.reason) details += `Reason: ${tx.reason}`;
        if (tx.meta && tx.meta.bookingId) details += ` | Booking: ${tx.meta.bookingId}`;
        if (tx.adminAction) details += ' | Admin Action';
        detailsCell.textContent = details || 'N/A';
        detailsCell.style.fontSize = '0.9em';
        detailsCell.style.color = '#666';
      });
      
    } catch (error) {
      console.error("Error loading transaction history:", error);
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Error loading transactions. Check console.</td></tr>';
    }
  };

  // Close wallet points modal
  const closeWalletPointsModalBtn = document.getElementById('close-wallet-points-modal');
  if (closeWalletPointsModalBtn) {
    closeWalletPointsModalBtn.onclick = function() {
      document.getElementById('wallet-points-modal').style.display = 'none';
    };
  }

  // Close modal when clicking outside
  const walletPointsModal = document.getElementById('wallet-points-modal');
  if (walletPointsModal) {
    walletPointsModal.addEventListener('click', function(e) {
      if (e.target === walletPointsModal) {
        walletPointsModal.style.display = 'none';
      }
    });
  }

  // Close wallet transaction history modal
  const closeWalletTransactionHistoryModalBtn = document.getElementById('close-wallet-transaction-history-modal');
  if (closeWalletTransactionHistoryModalBtn) {
    closeWalletTransactionHistoryModalBtn.onclick = function() {
      document.getElementById('wallet-transaction-history-modal').style.display = 'none';
    };
  }

  // Close transaction history modal when clicking outside
  const walletTransactionHistoryModal = document.getElementById('wallet-transaction-history-modal');
  if (walletTransactionHistoryModal) {
    walletTransactionHistoryModal.addEventListener('click', function(e) {
      if (e.target === walletTransactionHistoryModal) {
        walletTransactionHistoryModal.style.display = 'none';
      }
    });
  }

  // Wallet points form submission
  const walletPointsForm = document.getElementById('wallet-points-form');
  if (walletPointsForm) {
    walletPointsForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const userId = document.getElementById('wallet-user-id').value;
      const userEmail = document.getElementById('wallet-user-email').value;
      const currentBalance = parseInt(document.getElementById('wallet-current-balance').value) || 0;
      const actionType = document.getElementById('wallet-action-type').value;
      const pointsAmount = parseInt(document.getElementById('wallet-points-amount').value);
      const reason = document.getElementById('wallet-reason').value.trim();
      
      if (!userId || !pointsAmount || !reason) {
        showToast('Please fill all required fields', 'error');
        return;
      }
      
      try {
        // Create transaction record
        const transactionData = {
          userId: userId,
          userEmail: userEmail,
          action: actionType === 'add' ? 'manual-add' : 'manual-deduct',
          points: actionType === 'add' ? pointsAmount : -pointsAmount,
          reason: reason,
          adminAction: true,
          status: 'completed',
          date: firebaseFirestoreFunctions.serverTimestamp()
        };
        
        await firebaseFirestoreFunctions.addDoc(
          firebaseFirestoreFunctions.collection(dbInstance, "walletTransactions"),
          transactionData
        );
        
        // Debug logging before updating user document
        const userDocRef = firebaseFirestoreFunctions.doc(dbInstance, 'users', userId);
        const newBalance = actionType === 'add'
          ? (currentBalance + pointsAmount)
          : (currentBalance - pointsAmount);
        console.log('DEBUG: Updating user pointsBalance', {
          userId,
          currentBalance,
          pointsAmount,
          actionType,
          newBalance
        });
        try {
          await firebaseFirestoreFunctions.updateDoc(userDocRef, {
            pointsBalance: newBalance
          });
        } catch (err) {
          console.error('DEBUG: Firestore updateDoc error:', err);
        }
        
        showToast(`Points ${actionType === 'add' ? 'added' : 'deducted'} successfully!`, 'success');
        document.getElementById('wallet-points-modal').style.display = 'none';
        
        // Refresh wallet table
        await loadUserWallets();
        
      } catch (err) {
        console.error('DEBUG: Wallet points form submission error:', err);
        showToast('Failed to update wallet points: ' + err.message, 'error');
      }
    });
  }

  // Booking Details Modal Functions
  window.viewBookingDetails = async function(bookingId) {
    try {
      const bookingDoc = await firebaseFirestoreFunctions.getDoc(firebaseFirestoreFunctions.doc(dbInstance, 'bookings', bookingId));
      if (!bookingDoc.exists()) {
        showToast('Booking not found!', 'error');
        return;
      }
      
      const booking = { id: bookingDoc.id, ...bookingDoc.data() };
      
      // Get user details for membership status
      const userDoc = await firebaseFirestoreFunctions.getDoc(firebaseFirestoreFunctions.doc(dbInstance, 'users', booking.userId));
      const user = userDoc.exists() ? userDoc.data() : {};
      const userRole = user.role || 'non-member';
      const isMember = userRole === 'member';
      
      // Create detailed booking view
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.display = 'flex';
      modal.style.position = 'fixed';
      modal.style.zIndex = '1000';
      modal.style.left = '0';
      modal.style.top = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0,0,0,0.4)';
      
      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content card-style';
      modalContent.style.maxWidth = '900px';
      modalContent.style.maxHeight = '90vh';
      modalContent.style.overflow = 'auto';
      
      const closeBtn = document.createElement('span');
      closeBtn.className = 'close-modal-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.style.float = 'right';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.fontSize = '1.5em';
      closeBtn.onclick = () => modal.remove();
      
      const bookingDate = booking.bookingDate ? booking.bookingDate.toDate().toLocaleString('en-IN') : 'N/A';
      const totalMRP = booking.items.reduce((sum, item) => sum + (item.originalPrice || item.price), 0);
      const totalSavings = totalMRP - booking.totalAmount;
      
      modalContent.innerHTML = `
        ${closeBtn.outerHTML}
        <h3><i class="fas fa-calendar-check"></i> Booking Details - ${booking.id}</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 25px;">
          <!-- User Information -->
          <div class="card-style" style="padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border-left: 5px solid #4a90e2; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <h4 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">👤</span> User Information
            </h4>
            <p style="margin: 10px 0; font-weight: 600; font-size: 15px; color: #2c3e50;"><strong>Name:</strong> ${booking.userName || 'N/A'}</p>
            <p style="margin: 10px 0; font-size: 14px; color: #555;"><strong>📧 Email:</strong> ${booking.userEmail || 'N/A'}</p>
            <p style="margin: 10px 0; font-size: 14px; color: #555;"><strong>📞 Phone:</strong> ${booking.userPhone || 'N/A'}</p>
            <p style="margin: 10px 0; font-size: 14px; color: #555;"><strong>Membership:</strong> 
              <span class="badge ${isMember ? 'badge-member' : 'badge-status'}">${isMember ? 'Premium Member' : 'Standard Customer'}</span>
            </p>
          </div>
          
          <!-- Booking Summary -->
          <div class="card-style" style="padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border-left: 5px solid #28a745; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <h4 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">📋</span> Booking Summary
            </h4>
            <p style="margin: 10px 0; font-size: 14px; color: #555;"><strong>📅 Booking Date:</strong> ${bookingDate}</p>
            <p style="margin: 10px 0; font-size: 14px; color: #555;"><strong>Status:</strong> <span style="color: #007bff; font-weight: 600; background: rgba(0,123,255,0.1); padding: 2px 8px; border-radius: 8px;">${booking.status}</span></p>
            <p style="margin: 10px 0; font-size: 14px; color: #555;"><strong>💰 Total Amount:</strong> <span style="font-weight: 600; color: #2c3e50;">₹${booking.totalAmount}</span></p>
            <p style="margin: 10px 0; font-size: 14px; color: #555;"><strong>🏷️ Total MRP:</strong> <span style="text-decoration: line-through; color: #666;">₹${totalMRP}</span></p>
            <p style="margin: 10px 0; font-size: 14px; color: #555;"><strong>💾 Total Savings:</strong> <span style="color: #28a745; font-weight: 600; background: rgba(40,167,69,0.1); padding: 2px 8px; border-radius: 8px;">₹${totalSavings}</span></p>
            <p style="margin: 10px 0; font-size: 14px; color: #555;"><strong>🔬 Number of Tests:</strong> <span style="font-weight: 600; color: #2c3e50;">${booking.items.length}</span></p>
          </div>
        </div>
        
        <!-- Test Details -->
        <div class="card-style" style="padding: 20px; margin-bottom: 25px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border-left: 5px solid #ffc107; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <h4 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🔬</span> Test Details
          </h4>
          <div style="display: grid; gap: 20px;">
            ${booking.items.map((item, index) => {
              const originalPrice = item.originalPrice || item.price;
              const discount = originalPrice - item.price;
              const discountPercent = originalPrice > 0 ? Math.round((discount / originalPrice) * 100) : 0;
              const appointmentTime = item.appointmentDateTime ? new Date(item.appointmentDateTime).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short'
              }) : 'Not scheduled';
              
              return `
                <div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 20px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                    <!-- Test Info -->
                    <div style="border-right: 1px solid #e0e0e0; padding-right: 15px;">
                      <h5 style="color: #007bff; margin-bottom: 12px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 18px;">🧪</span> Test ${index + 1}
                      </h5>
                      <p style="margin: 8px 0; font-size: 14px; color: #555;"><strong>Test Name:</strong> <span style="font-weight: 600; color: #2c3e50;">${item.testName}</span></p>
                      <p style="margin: 8px 0; font-size: 14px; color: #555;"><strong>Test ID:</strong> <span style="font-family: monospace; background: #f8f9fa; padding: 2px 6px; border-radius: 4px;">${item.testId}</span></p>
                    </div>
                    
                    <!-- Lab & Timing -->
                    <div style="border-right: 1px solid #e0e0e0; padding-right: 15px;">
                      <h5 style="color: #28a745; margin-bottom: 12px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 18px;">🏥</span> Lab & Timing
                      </h5>
                      <p style="margin: 8px 0; font-size: 14px; color: #555;"><strong>Lab:</strong> <span style="font-weight: 600; color: #2c3e50;">${item.labName}</span></p>
                      <p style="margin: 8px 0; font-size: 14px; color: #555;"><strong>Appointment:</strong> <span style="font-weight: 600; color: #2c3e50; background: rgba(40,167,69,0.1); padding: 2px 8px; border-radius: 6px;">${appointmentTime}</span></p>
                    </div>
                    
                    <!-- Pricing -->
                    <div>
                      <h5 style="color: #ffc107; margin-bottom: 12px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 18px;">💰</span> Pricing
                      </h5>
                      <p style="margin: 8px 0; font-size: 14px; color: #555;"><strong>Final Price:</strong> <span style="font-weight: 600; color: #2c3e50; font-size: 16px;">₹${item.price}</span></p>
                      ${originalPrice !== item.price ? `
                        <p style="margin: 8px 0; font-size: 14px; color: #555;"><strong>MRP:</strong> <span style="text-decoration: line-through; color: #666;">₹${originalPrice}</span></p>
                        <p style="margin: 8px 0; font-size: 14px; color: #555;"><strong>Discount:</strong> <span style="color: #28a745; font-weight: 600; background: rgba(40,167,69,0.1); padding: 2px 8px; border-radius: 6px;">₹${discount} (${discountPercent}%)</span></p>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        <!-- Actions -->
        <div style="text-align: center; margin-top: 20px;">
          <button class="btn btn-primary" onclick="generateInvoice('${booking.id}')" style="margin-right: 10px;">
            <i class="fas fa-file-invoice"></i> Generate Invoice
          </button>
          <button class="btn btn-info" onclick="updateBookingStatus('${booking.id}')" style="margin-right: 10px;">
            <i class="fas fa-edit"></i> Update Status
          </button>
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
            <i class="fas fa-times"></i> Close
          </button>
        </div>
      `;
      
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
      
      // Close modal when clicking outside
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          modal.remove();
        }
      });
      
    } catch (error) {
      console.error('Error loading booking details:', error);
      showToast('Error loading booking details!', 'error');
    }
  };

  window.updateBookingStatus = function(bookingId) {
    // This function can be enhanced to show a dedicated status update modal
    showToast('Use the status dropdown in the table to update booking status!', 'info');
  };

  // Professional Invoice Generation Function
  window.generateInvoice = async function(bookingId) {
    try {
      const bookingDoc = await firebaseFirestoreFunctions.getDoc(firebaseFirestoreFunctions.doc(dbInstance, 'bookings', bookingId));
      if (!bookingDoc.exists()) {
        showToast('Booking not found!', 'error');
        return;
      }
      
      const booking = { id: bookingDoc.id, ...bookingDoc.data() };
      
      // Get user details
      const userDoc = await firebaseFirestoreFunctions.getDoc(firebaseFirestoreFunctions.doc(dbInstance, 'users', booking.userId));
      const user = userDoc.exists() ? userDoc.data() : {};
      
      // Generate invoice HTML
      const invoiceHTML = generateInvoiceHTML(booking, user);
      
      // Create invoice modal
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.display = 'flex';
      modal.style.position = 'fixed';
      modal.style.zIndex = '1000';
      modal.style.left = '0';
      modal.style.top = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0,0,0,0.4)';
      
      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content';
      modalContent.style.maxWidth = '900px';
      modalContent.style.maxHeight = '90vh';
      modalContent.style.overflow = 'auto';
      modalContent.style.background = 'white';
      modalContent.style.color = '#333';
      modalContent.style.padding = '0';
      modalContent.style.borderRadius = '12px';
      modalContent.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
      modalContent.style.border = '1px solid #e0e0e0';
      
      const closeBtn = document.createElement('span');
      closeBtn.className = 'close-modal-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '10px';
      closeBtn.style.right = '15px';
      closeBtn.style.fontSize = '24px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.color = '#666';
      closeBtn.onclick = () => modal.remove();
      
      modalContent.innerHTML = `
        ${closeBtn.outerHTML}
        <div style="padding: 20px;">
          ${invoiceHTML}
        </div>
        <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; background: #f8f9fa;">
          <button class="btn btn-primary" onclick="printInvoice()" style="margin-right: 10px;">
            <i class="fas fa-print"></i> Print Invoice
          </button>
          <button class="btn btn-success" onclick="downloadInvoice()" style="margin-right: 10px;">
            <i class="fas fa-download"></i> Download PDF
          </button>
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
            <i class="fas fa-times"></i> Close
          </button>
        </div>
      `;
      
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
      
      // Close modal when clicking outside
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          modal.remove();
        }
      });
      
    } catch (error) {
      console.error('Error generating invoice:', error);
      showToast('Error generating invoice!', 'error');
    }
  };

  // Generate professional invoice HTML
  function generateInvoiceHTML(booking, user) {
    const invoiceNumber = `INV-${booking.id.slice(-8).toUpperCase()}`;
    const invoiceDate = new Date().toLocaleDateString('en-IN');
    const bookingDate = booking.bookingDate ? booking.bookingDate.toDate().toLocaleDateString('en-IN') : 'N/A';
    const totalMRP = booking.items.reduce((sum, item) => sum + (item.originalPrice || item.price), 0);
    const totalSavings = totalMRP - booking.totalAmount;
    
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 100%;">
        <!-- Header -->
        <div style="border-bottom: 3px solid #4a90e2; padding-bottom: 20px; margin-bottom: 30px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h1 style="color: #4a90e2; margin: 0; font-size: 28px; font-weight: 700;">SMART BHARAT HEALTH SERVICES</h1>
              <p style="color: #666; margin: 5px 0; font-size: 14px;">Professional Healthcare & Diagnostic Services</p>
              <p style="color: #666; margin: 5px 0; font-size: 14px;">📞 Contact: +91-XXXXXXXXXX | 📧 info@smartbharat.com</p>
              <p style="color: #666; margin: 5px 0; font-size: 14px;">📍 Address: [Your Business Address]</p>
            </div>
            <div style="text-align: right;">
              <div style="background: #4a90e2; color: white; padding: 15px; border-radius: 8px; min-width: 200px;">
                <h3 style="margin: 0; font-size: 18px;">INVOICE</h3>
                <p style="margin: 5px 0; font-size: 14px;">Invoice #: ${invoiceNumber}</p>
                <p style="margin: 5px 0; font-size: 14px;">Date: ${invoiceDate}</p>
                <p style="margin: 5px 0; font-size: 14px;">Booking #: ${booking.id}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Customer Information -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #4a90e2;">
            <h3 style="color: #4a90e2; margin: 0 0 15px 0; font-size: 18px;">Bill To:</h3>
            <p style="margin: 5px 0; font-weight: 600; font-size: 16px;">${booking.userName || 'N/A'}</p>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">📧 ${booking.userEmail || 'N/A'}</p>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">📞 ${booking.userPhone || 'N/A'}</p>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">👤 ${user.role === 'member' ? 'Premium Member' : 'Standard Customer'}</p>
          </div>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h3 style="color: #28a745; margin: 0 0 15px 0; font-size: 18px;">Booking Details:</h3>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Booking Date:</strong> ${bookingDate}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Status:</strong> <span style="color: #007bff; font-weight: 600;">${booking.status}</span></p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Tests:</strong> ${booking.items.length} item(s)</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Payment Status:</strong> <span style="color: #28a745; font-weight: 600;">Paid</span></p>
          </div>
        </div>

        <!-- Services Table -->
        <div style="margin-bottom: 30px;">
          <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">Services Rendered:</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
              <tr style="background: #4a90e2; color: white;">
                <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Sr. No.</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Test Name</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Lab</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Appointment</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">MRP</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Discount</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Final Price</th>
              </tr>
            </thead>
            <tbody>
              ${booking.items.map((item, index) => {
                const originalPrice = item.originalPrice || item.price;
                const discount = originalPrice - item.price;
                const discountPercent = originalPrice > 0 ? Math.round((discount / originalPrice) * 100) : 0;
                const appointmentTime = item.appointmentDateTime ? new Date(item.appointmentDateTime).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                }) : 'Not scheduled';
                
                return `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px; border: 1px solid #ddd;">${index + 1}</td>
                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600;">${item.testName}</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">${item.labName}</td>
                    <td style="padding: 12px; border: 1px solid #ddd; font-size: 13px;">${appointmentTime}</td>
                    <td style="padding: 12px; border: 1px solid #ddd; text-align: right; text-decoration: line-through; color: #666;">₹${originalPrice}</td>
                    <td style="padding: 12px; border: 1px solid #ddd; text-align: right; color: #28a745;">₹${discount} (${discountPercent}%)</td>
                    <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: 600;">₹${item.price}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Summary -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">Payment Summary:</h3>
            <div style="display: flex; justify-content: space-between; margin: 8px 0;">
              <span>Total MRP:</span>
              <span style="text-decoration: line-through; color: #666;">₹${totalMRP}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; color: #28a745;">
              <span>Total Discount:</span>
              <span>₹${totalSavings}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 8px 0; font-weight: 600; font-size: 16px; color: #4a90e2; border-top: 1px solid #ddd; padding-top: 8px;">
              <span>Final Amount:</span>
              <span>₹${booking.totalAmount}</span>
            </div>
          </div>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">Terms & Conditions:</h3>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #666;">
              <li>Payment is due upon receipt of this invoice</li>
              <li>Results will be available within 24-48 hours</li>
              <li>Please bring this invoice for sample collection</li>
              <li>For any queries, contact our customer support</li>
              <li>GST will be applicable as per government regulations</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="border-top: 2px solid #4a90e2; padding-top: 20px; text-align: center; color: #666; font-size: 14px;">
          <p style="margin: 5px 0;"><strong>Thank you for choosing SMART BHARAT HEALTH SERVICES!</strong></p>
          <p style="margin: 5px 0;">Your health is our priority. We strive to provide the best healthcare services.</p>
          <p style="margin: 5px 0;">📞 Customer Support: +91-XXXXXXXXXX | 📧 support@smartbharat.com</p>
          <p style="margin: 5px 0; font-size: 12px; color: #999;">This is a computer-generated invoice. No signature required.</p>
        </div>
      </div>
    `;
  }

  // Print invoice function
  window.printInvoice = function() {
    const printWindow = window.open('', '_blank');
    const invoiceContent = document.querySelector('.modal-content div[style*="padding: 20px"]').innerHTML;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - SMART BHARAT HEALTH SERVICES</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; }
            @media print { body { margin: 0; } }
            .no-print { display: none; }
          </style>
        </head>
        <body>
          ${invoiceContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  };

  // Download invoice as PDF function
  window.downloadInvoice = function() {
    showToast('PDF download feature will be implemented soon!', 'info');
    // TODO: Implement PDF generation using jsPDF or similar library
  };

  // Add Lab Price button for add form
  const addLabPriceBtnAdd = document.getElementById('add-lab-price-row-btn-add');
  if (addLabPriceBtnAdd) {
    addLabPriceBtnAdd.addEventListener('click', function() {
      const labPricesContainer = document.getElementById('lab-prices-container-add');
      if (!labPricesContainer) return;
      
      const rowDiv = document.createElement('div');
      rowDiv.className = 'lab-price-row';
      rowDiv.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center; flex-wrap: wrap;';
      
      // Create lab select dropdown
      const labSelect = document.createElement('select');
      labSelect.required = true;
      labSelect.style.cssText = 'flex: 1; min-width: 150px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;';
      
      // Populate labs dropdown
      labSelect.innerHTML = '<option value="">Select Lab</option>';
      labsListCache.forEach(lab => {
        const option = document.createElement('option');
        option.value = lab.id;
        option.textContent = lab.name;
        labSelect.appendChild(option);
      });
      
      // Create price input
      const priceInput = document.createElement('input');
      priceInput.type = 'number';
      priceInput.placeholder = 'Price (₹)';
      priceInput.required = true;
      priceInput.style.cssText = 'width: 100px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;';
      
      // Create original price input
      const originalPriceInput = document.createElement('input');
      originalPriceInput.type = 'number';
      originalPriceInput.placeholder = 'Original Price (₹)';
      originalPriceInput.style.cssText = 'width: 120px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;';
      
      // Create member price input
      const memberPriceInput = document.createElement('input');
      memberPriceInput.type = 'number';
      memberPriceInput.placeholder = 'Member Price (₹)';
      memberPriceInput.style.cssText = 'width: 120px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;';
      
      // Create remove button
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
      removeBtn.className = 'btn btn-danger btn-sm';
      removeBtn.style.cssText = 'padding: 6px 8px;';
      removeBtn.onclick = function() {
        rowDiv.remove();
      };
      
      rowDiv.appendChild(labSelect);
      rowDiv.appendChild(priceInput);
      rowDiv.appendChild(originalPriceInput);
      rowDiv.appendChild(memberPriceInput);
      rowDiv.appendChild(removeBtn);
      
      labPricesContainer.appendChild(rowDiv);
    });
  }

    // ----- App Entry Point -----
    
    initializeAppEventListeners();

    firebaseAuthFunctions.onAuthStateChanged(authInstance, async (user) => {
        if (user) {
        const isAdmin = allowedAdminUIDs.includes(user.uid) || allowedAdminEmails.includes(user.email);
        if (isAdmin) {
          await showDashboardUI(user);
        } else {
          await firebaseAuthFunctions.signOut(authInstance);
    showLoginScreen();
          showToast("You are not authorized for this panel.", "error");
    }
  } else {
        showLoginScreen();
      }
    });

  }).catch(error => {
    console.error("CRITICAL: Failed to initialize Firebase services. The app cannot run.", error);
      showLoader(false);
    const errorBanner = document.getElementById('critical-error-banner');
    if (errorBanner) {
      errorBanner.textContent = 'A critical error occurred while loading Firebase. The application cannot start.';
      errorBanner.style.display = 'block';
    }
  });
});