// Admin Panel JavaScript - app.js

console.log('[DEBUG] app.js loaded');

// Import Firebase services from firebase-config.js
import {
    firebaseConfigLoaded,
    appInstance,
    authInstance,
    dbInstance,
    storageInstance, // If you plan to use Firebase Storage for other things
    firebaseAuthFunctions,
    firebaseFirestoreFunctions,
    firebaseStorageFunctions // If you plan to use Firebase Storage for other things
} from './firebase-config.js';

// ----- Configuration -----
const CLOUDINARY_CLOUD_NAME = "dvgilt12w";
const CLOUDINARY_UPLOAD_PRESET = "my-preset"; // Ensure this is an UNSIGNED preset
const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

const allowedAdminUIDs = ["OgrmQ6O90zStYCfbrZ3isyz1cVe2"];

// ----- Global State Variables -----
let labsListCache = []; // Cache for lab names and IDs
let testsListCache = []; // Cache for test names and IDs
let healthConcernsListCache = []; // Cache for health concerns

let currentEditingLabId = null;
let currentEditingTestId = null;
let currentEditingHcId = null;
let currentEditingOfferId = null;
let currentEditingPrescriptionId = null;
let currentEditingBannerId = null;
let currentEditingBannerType = null; // 'primary' or 'secondary'

// ----- Utility Functions -----
function showLoader(show) {
    const loaderContainer = document.getElementById('loader-container');
    if (loaderContainer) {
        loaderContainer.style.display = show ? 'flex' : 'none';
    } else {
        console.warn("Loader container not found.");
    }
}

function showToast(message, type = 'success', duration = 3000) {
    const toastNotificationElement = document.getElementById('toast-notification');
    if (!toastNotificationElement) {
        console.warn("Toast notification element not found. Cannot show toast:", message);
        alert(`${type.toUpperCase()}: ${message}`); // Fallback to alert
        return;
    }
    toastNotificationElement.textContent = message;
    toastNotificationElement.className = `toast-notification show ${type}`;
    setTimeout(() => {
        toastNotificationElement.className = 'toast-notification';
    }, duration);
}

function generateSlug(text) {
    if (!text || typeof text !== 'string') return '';
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')        // Replace spaces with -
        .replace(/[^\w-]+/g, '')   // Remove all non-word chars
        .replace(/--+/g, '-')       // Replace multiple - with single -
        .replace(/^-+/, '')          // Trim - from start of text
        .replace(/-+$/, '');         // Trim - from end of text
}

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(CLOUDINARY_API_URL, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (data.secure_url) {
            return data.secure_url;
        } else {
            console.error("Cloudinary upload error response:", data);
            let errorMessage = data.error?.message || 'Cloudinary upload failed. Unknown error.';
            if (data.error?.message?.includes('unsigned')) {
                errorMessage = `Cloudinary Configuration Error: The upload preset "${CLOUDINARY_UPLOAD_PRESET}" is not configured for UNSIGNED uploads. Verify this in your Cloudinary dashboard.`;
            } else if (data.error?.message?.includes('api_key') || data.error?.message?.includes('Cloud name')) {
                errorMessage = `Cloudinary Configuration Error: Invalid Cloud Name ("${CLOUDINARY_CLOUD_NAME}") or API setup. Check NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.`;
            }
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error("Cloudinary upload fetch/network error: ", error);
        throw error; // Re-throw to be caught by the caller
    }
}

function setupImageUpload(fileInputId, urlInputId, previewImgId, uploadBtnId) {
    const fileInput = document.getElementById(fileInputId);
    const urlInput = document.getElementById(urlInputId);
    const previewImg = document.getElementById(previewImgId);
    const uploadBtn = document.getElementById(uploadBtnId);

    if (!fileInput || !urlInput || !previewImg || !uploadBtn) {
        console.warn(`setupImageUpload: Missing one or more elements for IDs: fileInputId-'${fileInputId}', urlInputId-'${urlInputId}', previewImgId-'${previewImgId}', uploadBtnId-'${uploadBtnId}'.`);
        return;
    }
    console.log(`setupImageUpload: Initializing for ${fileInputId}`);


    // Preview when URL is manually changed
    urlInput.addEventListener('input', () => {
        if (urlInput.value) {
            previewImg.src = urlInput.value;
            previewImg.style.display = 'block';
        } else {
            previewImg.style.display = 'none';
            previewImg.src = '#';
        }
    });

    // Preview when file is selected (before upload)
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
            }
            reader.readAsDataURL(file);
            urlInput.value = ''; // Clear URL if a file is chosen
        }
    });
    
    // Upload to Cloudinary when button is clicked
    uploadBtn.onclick = async () => { // Changed to onclick
        if (!fileInput.files || fileInput.files.length === 0) {
            showToast("Please select an image file first.", "error");
            return;
        }
        const file = fileInput.files[0];
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

        try {
            const imageUrl = await uploadToCloudinary(file);
            urlInput.value = imageUrl;
            previewImg.src = imageUrl; // Update preview with Cloudinary URL
            previewImg.style.display = 'block';
            showToast("Image uploaded to Cloudinary and URL populated. Remember to save the item.", "success");
        } catch (error) {
            showToast(`Cloudinary upload failed: ${error.message}`, "error", 5000);
            console.error("Cloudinary upload error during setupImageUpload:", error);
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload Image';
             if(uploadBtnId.includes('hc-icon')) uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload Icon';
             if(uploadBtnId.includes('site-logo')) uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload Logo';
        }
    };
}

async function firestoreRequest(operation, collectionPath, docId = null, data = null, constraints = []) {
    if (!dbInstance || !firebaseFirestoreFunctions) {
        console.error("Firestore not available for", operation, "on", collectionPath);
        showToast(`Firestore service not available. Cannot perform ${operation}.`, "error");
        throw new Error("Firestore service not available.");
    }

    const { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp, Timestamp } = firebaseFirestoreFunctions;

    try {
        switch (operation) {
            case 'getDoc':
                if (!docId) throw new Error("docId is required for getDoc operation.");
                const docRefGet = doc(dbInstance, collectionPath, docId);
                return await getDoc(docRefGet);
            case 'getDocs':
                const collRefGet = collection(dbInstance, collectionPath);
                const parsedConstraints = constraints.map(c => {
                    if (c.type === 'where') return where(c.field, c.op, c.value);
                    if (c.type === 'orderBy') return orderBy(c.field, c.direction || 'asc');
                    if (c.type === 'limit') return limit(c.value);
                    return null;
                }).filter(c => c !== null);
                const qGet = query(collRefGet, ...parsedConstraints);
                return await getDocs(qGet);
            case 'addDoc':
                if (!data) throw new Error("Data is required for addDoc operation.");
                const collRefAdd = collection(dbInstance, collectionPath);
                return await addDoc(collRefAdd, { ...data, createdAt: serverTimestamp(), lastUpdatedAt: serverTimestamp() });
            case 'setDoc': // Used for creating/overwriting a doc with a specific ID
                if (!docId || !data) throw new Error("docId and data are required for setDoc operation.");
                const docRefSet = doc(dbInstance, collectionPath, docId);
                return await setDoc(docRefSet, { ...data, lastUpdatedAt: serverTimestamp() }, { merge: true }); // Use merge to avoid overwriting if doc exists partially
            case 'updateDoc':
                if (!docId || !data) throw new Error("docId and data are required for updateDoc operation.");
                const docRefUpdate = doc(dbInstance, collectionPath, docId);
                return await updateDoc(docRefUpdate, { ...data, lastUpdatedAt: serverTimestamp() });
            case 'deleteDoc':
                if (!docId) throw new Error("docId is required for deleteDoc operation.");
                const docRefDelete = doc(dbInstance, collectionPath, docId);
                return await deleteDoc(docRefDelete);
            default:
                throw new Error(`Unknown Firestore operation: ${operation}`);
        }
    } catch (error) {
        console.error(`Firestore operation '${operation}' failed for path '${collectionPath}/${docId || ''}':`, error);
        showToast(`Firestore error: ${error.message}`, "error", 5000);
        throw error;
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.warn(`Modal with ID ${modalId} not found.`);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    } else {
        console.warn(`Modal with ID ${modalId} not found.`);
    }
}

// ----- Data Loading Functions -----
async function loadLabs() {
    const labsTableBody = document.getElementById('labs-table-body');
    if (!labsTableBody) {
        console.warn("Labs table body not found! Cannot load labs.");
        return;
    }
    labsTableBody.innerHTML = '<tr><td colspan="3">Loading labs...</td></tr>';
    try {
        const querySnapshot = await firestoreRequest('getDocs', 'labs', null, null, [{ type: 'orderBy', field: 'name' }]);
        labsListCache = []; // Clear cache before reloading
        if (querySnapshot.empty) {
            labsTableBody.innerHTML = '<tr><td colspan="3">No labs found. Add some!</td></tr>';
            return;
        }
        labsTableBody.innerHTML = ''; // Clear loading message
        querySnapshot.forEach(docSnap => {
            const labData = docSnap.data();
            const labId = docSnap.id;
            labsListCache.push({ id: labId, name: labData.name }); // Populate cache

            const row = labsTableBody.insertRow();
            row.insertCell().textContent = labData.name || 'N/A';
            row.insertCell().textContent = labData.location || 'N/A';
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="btn btn-secondary btn-sm edit-btn" data-id="${labId}" data-type="lab"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${labId}" data-type="lab"><i class="fas fa-trash"></i> Delete</button>
            `;
        });
        console.log("Labs loaded and cache populated:", labsListCache);
    } catch (error) {
        labsTableBody.innerHTML = '<tr><td colspan="3">Error loading labs. Check console.</td></tr>';
        console.error("Error loading labs:", error);
    }
}

// Placeholder function, to be fully implemented
async function loadTests() {
    const testsTableBody = document.getElementById('tests-table-body');
    const searchInput = document.getElementById('test-search-input');
    const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (!testsTableBody) {
        console.warn("Tests table body not found! Cannot load tests.");
        return;
    }
    testsTableBody.innerHTML = '<tr><td colspan="11">Loading tests...</td></tr>';
    try {
        const testsSnapshot = await firestoreRequest('getDocs', 'tests', null, null, [{ type: 'orderBy', field: 'testName' }]);
        testsListCache = [];
        if (testsSnapshot.empty) {
            testsTableBody.innerHTML = '<tr><td colspan="11">No tests found. Add some!</td></tr>';
            return;
        }
        testsTableBody.innerHTML = '';
        let testsArray = [];
        for (const testDoc of testsSnapshot.docs) {
            const testData = testDoc.data();
            const testId = testDoc.id;
            testsArray.push({ ...testData, id: testId });
        }
        // Sort alphabetically by testName
        testsArray.sort((a, b) => (a.testName || '').localeCompare(b.testName || '', undefined, { sensitivity: 'base' }));
        let rowsAdded = 0;
        for (const testData of testsArray) {
            testsListCache.push({ id: testData.id, name: testData.testName });
            if (searchValue) {
                const name = (testData.testName || '').toLowerCase().trim();
                let tagsArr = [];
                if (Array.isArray(testData.tags)) {
                    tagsArr = testData.tags.map(t => (t || '').toLowerCase().trim());
                } else if (typeof testData.tags === 'string') {
                    tagsArr = testData.tags.split(',').map(t => t.toLowerCase().trim());
                }
                // Partial match: name or any tag contains the search value
                const nameMatch = name.includes(searchValue);
                const tagMatch = tagsArr.some(tag => tag.includes(searchValue));
                if (!(nameMatch || tagMatch)) {
                    continue;
                }
            }
            // Fetch lab prices for this test
            const pricesSnapshot = await firestoreRequest('getDocs', 'testLabPrices', null, null, [{ type: 'where', field: 'testId', op: '==', value: testData.id }]);
            let labPricesHtml = '<ul>';
            if (pricesSnapshot.empty) {
                labPricesHtml += '<li>No prices set</li>';
            } else {
                pricesSnapshot.forEach(priceDoc => {
                    const priceData = priceDoc.data();
                    labPricesHtml += `<li>${priceData.labName || 'Unknown Lab'}: ₹${priceData.price || 0} (MRP: ₹${priceData.originalPrice || priceData.price || 0})</li>`;
                });
            }
            labPricesHtml += '</ul>';

            // Fetch health concern names for this test
            let healthConcernsHtml = 'N/A';
            if (testData.healthConcernSlugs && testData.healthConcernSlugs.length > 0 && healthConcernsListCache.length > 0) {
                healthConcernsHtml = '<ul>';
                testData.healthConcernSlugs.forEach(slug => {
                    const concern = healthConcernsListCache.find(hc => hc.slug === slug);
                    if (concern) {
                        healthConcernsHtml += `<li>${concern.name}</li>`;
                    }
                });
                healthConcernsHtml += '</ul>';
                if(healthConcernsHtml === '<ul></ul>') healthConcernsHtml = 'N/A';
            }


            const row = testsTableBody.insertRow();
            row.insertCell().textContent = testData.testName || 'N/A';
            const descCell = row.insertCell();
            descCell.className = 'test-description-cell';
            descCell.innerHTML = (testData.description || 'N/A').replace(/\n/g, '<br>');
            
            const imageCell = row.insertCell();
            if (testData.imageUrl) {
                const img = document.createElement('img');
                img.src = testData.imageUrl;
                img.alt = testData.testName || 'Test Image';
                img.classList.add('test-image-thumbnail');
                img.onerror = function() { this.style.display='none'; imageCell.textContent = 'Invalid Img'; };
                imageCell.appendChild(img);
            } else {
                imageCell.textContent = 'No Image';
            }

            row.insertCell().textContent = testData.tags ? testData.tags.join(', ') : 'N/A';
            row.insertCell().textContent = testData.isPopular ? 'Yes' : 'No';
            row.insertCell().textContent = testData.isPackage ? 'Yes' : 'No';
            row.insertCell().textContent = testData.isActive === false ? 'No' : 'Yes'; // Default to Yes if undefined
            row.insertCell().textContent = testData.bannerText || 'N/A';
            row.insertCell().innerHTML = healthConcernsHtml;
            row.insertCell().innerHTML = labPricesHtml;
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="btn btn-secondary btn-sm edit-btn" data-id="${testData.id}" data-type="test"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${testData.id}" data-type="test"><i class="fas fa-trash"></i> Delete</button>
            `;
            rowsAdded++;
        }
        if (rowsAdded === 0) {
            testsTableBody.innerHTML = '<tr><td colspan="11">No tests found.</td></tr>';
        }
    } catch (error) {
        testsTableBody.innerHTML = '<tr><td colspan="11">Error loading tests. Check console.</td></tr>';
        console.error("Error loading tests:", error);
    }
}

async function loadHealthConcernsForAdmin() {
    const hcTableBody = document.getElementById('health-concerns-table-body');
    if (!hcTableBody) {
        console.warn("Health Concerns table body not found! Cannot load.");
        return;
    }
    hcTableBody.innerHTML = '<tr><td colspan="6">Loading health concerns...</td></tr>';
    try {
        const querySnapshot = await firestoreRequest('getDocs', 'healthConcerns', null, null, [{ type: 'orderBy', field: 'order' }]);
        healthConcernsListCache = [];
        if (querySnapshot.empty) {
            hcTableBody.innerHTML = '<tr><td colspan="6">No health concerns found. Add some!</td></tr>';
            return;
        }
        hcTableBody.innerHTML = '';
        querySnapshot.forEach(docSnap => {
            const hcData = docSnap.data();
            const hcId = docSnap.id;
            healthConcernsListCache.push({ id: hcId, name: hcData.name, slug: hcData.slug, iconUrl: hcData.iconUrl, order: hcData.order, isActive: hcData.isActive });

            const row = hcTableBody.insertRow();
            row.insertCell().textContent = hcData.name || 'N/A';
            
            const iconCell = row.insertCell();
            if (hcData.iconUrl) {
                const img = document.createElement('img');
                img.src = hcData.iconUrl;
                img.alt = hcData.name || 'Icon';
                img.classList.add('health-concern-icon-thumbnail');
                img.onerror = function() { this.style.display='none'; iconCell.textContent = 'Invalid Icon'; };
                iconCell.appendChild(img);
            } else {
                iconCell.textContent = 'No Icon';
            }
            
            row.insertCell().textContent = typeof hcData.order === 'number' ? hcData.order : 'N/A';
            row.insertCell().textContent = hcData.isActive ? 'Yes' : 'No';
            row.insertCell().textContent = hcData.slug || 'N/A';
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="btn btn-secondary btn-sm edit-btn" data-id="${hcId}" data-type="healthConcern"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${hcId}" data-type="healthConcern"><i class="fas fa-trash"></i> Delete</button>
            `;
        });
    } catch (error) {
        hcTableBody.innerHTML = '<tr><td colspan="6">Error loading health concerns. Check console.</td></tr>';
        console.error("Error loading health concerns:", error);
    }
}


async function loadOffers() {
    const offersTableBody = document.getElementById('offers-table-body');
     if (!offersTableBody) {
        console.warn("Offers table body not found! Cannot load offers.");
        return;
    }
    offersTableBody.innerHTML = '<tr><td colspan="8">Loading offers...</td></tr>';
    try {
        const tests = testsListCache.length > 0 ? testsListCache : (await firestoreRequest('getDocs', 'tests')).docs.map(d => ({id: d.id, ...d.data()}));

        const querySnapshot = await firestoreRequest('getDocs', 'offers', null, null, [{ type: 'orderBy', field: 'endDate', direction: 'desc' }]);
        if (querySnapshot.empty) {
            offersTableBody.innerHTML = '<tr><td colspan="8">No offers found. Add some!</td></tr>';
            return;
        }
        offersTableBody.innerHTML = ''; 
        querySnapshot.forEach(docSnap => {
            const offerData = docSnap.data();
            const offerId = docSnap.id;
            const test = tests.find(t => t.id === offerData.testId);

            const row = offersTableBody.insertRow();
            row.insertCell().textContent = offerData.title || 'N/A';
            row.insertCell().textContent = test ? test.name : (offerData.testId || 'Unknown Test');
            row.insertCell().textContent = offerData.discountPercentage !== undefined ? `${offerData.discountPercentage}%` : 'N/A';
            row.insertCell().textContent = offerData.couponCode || 'N/A';
            row.insertCell().textContent = offerData.startDate ? new Date(offerData.startDate).toLocaleDateString() : 'N/A';
            row.insertCell().textContent = offerData.endDate ? new Date(offerData.endDate).toLocaleDateString() : 'N/A';
            row.insertCell().textContent = offerData.isActive ? 'Yes' : 'No';
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="btn btn-secondary btn-sm edit-btn" data-id="${offerId}" data-type="offer"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${offerId}" data-type="offer"><i class="fas fa-trash"></i> Delete</button>
            `;
        });
    } catch (error) {
        offersTableBody.innerHTML = '<tr><td colspan="8">Error loading offers. Check console.</td></tr>';
        console.error("Error loading offers:", error);
    }
}

async function loadPrescriptions() {
    const prescriptionsTableBody = document.getElementById('prescriptions-table-body');
    if (!prescriptionsTableBody) {
        console.warn("Prescriptions table body not found! Cannot load.");
        return;
    }
    prescriptionsTableBody.innerHTML = '<tr><td colspan="6">Loading prescriptions...</td></tr>';
    try {
        const querySnapshot = await firestoreRequest('getDocs', 'prescriptions', null, null, [{ type: 'orderBy', field: 'timestamp', direction: 'desc' }]);
        if (querySnapshot.empty) {
            prescriptionsTableBody.innerHTML = '<tr><td colspan="6">No prescriptions found.</td></tr>';
            return;
        }
        prescriptionsTableBody.innerHTML = '';
        querySnapshot.forEach(docSnap => {
            const presData = docSnap.data();
            const presId = docSnap.id;
            const row = prescriptionsTableBody.insertRow();
            row.insertCell().textContent = presData.userName || 'N/A';
            row.insertCell().textContent = presData.phone || 'N/A';
            
            const imageCell = row.insertCell();
            if (presData.imageUrl) {
                const img = document.createElement('img');
                img.src = presData.imageUrl;
                img.alt = 'Prescription';
                img.classList.add('prescription-image-thumbnail'); // Use class for styling
                img.onerror = function() { this.style.display='none'; imageCell.textContent = 'Invalid Img'; };
                imageCell.appendChild(img);
            } else {
                imageCell.textContent = 'No Image';
            }
            
            row.insertCell().textContent = presData.timestamp ? presData.timestamp.toDate().toLocaleString() : 'N/A';
            row.insertCell().textContent = presData.status || 'Pending Review';
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="btn btn-secondary btn-sm edit-btn" data-id="${presId}" data-type="prescriptionStatus"><i class="fas fa-edit"></i> Update Status</button>
            `;
        });
    } catch (error) {
        prescriptionsTableBody.innerHTML = '<tr><td colspan="6">Error loading prescriptions. Check console.</td></tr>';
        console.error("Error loading prescriptions:", error);
    }
}


async function loadUsers() {
    const usersTableBody = document.getElementById('users-table-body');
    if (!usersTableBody) {
        console.warn("Users table body not found! Cannot load users.");
        return;
    }
    usersTableBody.innerHTML = '<tr><td colspan="6">Loading users...</td></tr>';
    try {
        const querySnapshot = await firestoreRequest('getDocs', 'users', null, null, [{ type: 'orderBy', field: 'createdAt', direction: 'desc' }]);
        if (querySnapshot.empty) {
            usersTableBody.innerHTML = '<tr><td colspan="6">No users found.</td></tr>';
            return;
        }
        usersTableBody.innerHTML = '';
        querySnapshot.forEach(docSnap => {
            const userData = docSnap.data();
            const userId = docSnap.id;
            const row = usersTableBody.insertRow();
            row.insertCell().textContent = userId;
            row.insertCell().textContent = userData.email || 'N/A';
            row.insertCell().textContent = userData.displayName || 'N/A';
            row.insertCell().textContent = userData.phoneNumber || 'N/A';
            row.insertCell().textContent = userData.createdAt ? userData.createdAt.toDate().toLocaleDateString() : 'N/A';
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="btn btn-info btn-sm view-bookings-btn" data-id="${userId}" data-username="${userData.displayName || userData.email || userId}"><i class="fas fa-list-alt"></i> View Bookings</button>
            `;
        });
    } catch (error) {
        usersTableBody.innerHTML = '<tr><td colspan="6">Error loading users. Check console.</td></tr>';
        console.error("Error loading users:", error);
    }
}

async function loadAllBookings() {
    const bookingsTableBody = document.getElementById('bookings-table-body');
    if (!bookingsTableBody) {
        console.warn("Bookings table body not found for admin! Cannot load.");
        return;
    }
    bookingsTableBody.innerHTML = '<tr><td colspan="8">Loading bookings...</td></tr>';

    try {
        const querySnapshot = await firestoreRequest('getDocs', 'bookings', null, null, 
            [{ type: 'orderBy', field: 'bookingDate', direction: 'desc' }]
        );

        if (querySnapshot.empty) {
            bookingsTableBody.innerHTML = '<tr><td colspan="8">No bookings found.</td></tr>';
            return;
        }

        bookingsTableBody.innerHTML = ''; // Clear loading message

        querySnapshot.forEach(docSnap => {
            const bookingData = docSnap.data();
            const bookingId = docSnap.id;

            const row = bookingsTableBody.insertRow();
            row.insertCell().textContent = bookingId;
            row.insertCell().textContent = bookingData.userName || 'N/A';
            row.insertCell().textContent = `${bookingData.userEmail || 'N/A'} / ${bookingData.userPhone || 'N/A'}`;
            row.insertCell().textContent = bookingData.bookingDate ? bookingData.bookingDate.toDate().toLocaleString() : 'N/A';
            row.insertCell().textContent = `₹${bookingData.totalAmount !== undefined ? bookingData.totalAmount.toFixed(2) : '0.00'}`;
            
            let itemsHtml = '<ul>';
            if (bookingData.items && bookingData.items.length > 0) {
                bookingData.items.forEach(item => {
                    itemsHtml += `<li>${item.testName} (${item.labName}) - ₹${item.price.toFixed(2)}</li>`;
                });
            } else {
                itemsHtml += '<li>No items</li>';
            }
            itemsHtml += '</ul>';
            row.insertCell().innerHTML = itemsHtml;
            
            const statusCell = row.insertCell();
            statusCell.textContent = bookingData.status || 'N/A';

            const actionsCell = row.insertCell();
            const statusSelect = document.createElement('select');
            statusSelect.classList.add('status-select');
            const statuses = ["Pending Confirmation", "Confirmed", "Processing", "Sample Collected", "Report Generated", "Completed", "Cancelled", "Refunded"];
            statuses.forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                if (status === bookingData.status) {
                    option.selected = true;
                }
                statusSelect.appendChild(option);
            });
            actionsCell.appendChild(statusSelect);

            const updateButton = document.createElement('button');
            updateButton.classList.add('btn', 'btn-secondary', 'btn-sm', 'update-booking-status-btn');
            updateButton.innerHTML = '<i class="fas fa-save"></i> Update';
            updateButton.dataset.id = bookingId;
            actionsCell.appendChild(updateButton);
        });
    } catch (error) {
        bookingsTableBody.innerHTML = '<tr><td colspan="8">Error loading bookings. Check console.</td></tr>';
        console.error("Error loading all bookings for admin:", error);
    }
}


async function loadBanners(bannerType) {
    console.log(`loadBanners called for ${bannerType}.`);
    const collectionName = bannerType === 'primary' ? 'promotionalBanners' : 'secondaryPromotionalBanners';
    const tableBodyId = bannerType === 'primary' ? 'primary-banners-table-body' : 'secondary-banners-table-body';
    const bannersTableBody = document.getElementById(tableBodyId);

    if (!bannersTableBody) {
        console.warn(`Banners table body ('${tableBodyId}') not found! Cannot load ${bannerType} banners.`);
        return;
    }
    bannersTableBody.innerHTML = `<tr><td colspan="8">Loading ${bannerType} banners...</td></tr>`;

    try {
        const querySnapshot = await firestoreRequest('getDocs', collectionName, null, null, [{ type: 'orderBy', field: 'order' }]);
        if (querySnapshot.empty) {
            bannersTableBody.innerHTML = `<tr><td colspan="8">No ${bannerType} banners found. Add some!</td></tr>`;
            return;
        }
        bannersTableBody.innerHTML = ''; 
        querySnapshot.forEach(docSnap => {
            const bannerData = docSnap.data();
            const bannerId = docSnap.id;

            const row = bannersTableBody.insertRow();
            row.insertCell().textContent = bannerData.title || 'N/A';
            row.insertCell().textContent = bannerData.subtitle || 'N/A';
            row.insertCell().textContent = bannerData.iconName || 'N/A';
            row.insertCell().textContent = bannerData.linkUrl || 'N/A';

            const imageCell = row.insertCell();
            if (bannerData.imageUrl) {
                const img = document.createElement('img');
                img.src = bannerData.imageUrl;
                img.alt = bannerData.title || 'Banner Image';
                img.classList.add('banner-image-thumbnail');
                img.onerror = function() { this.style.display='none'; imageCell.textContent = 'Invalid Img'; };
                imageCell.appendChild(img);
            } else {
                imageCell.textContent = 'No Image';
            }
            
            row.insertCell().textContent = typeof bannerData.order === 'number' ? bannerData.order : 'N/A';
            row.insertCell().textContent = bannerData.isActive ? 'Yes' : 'No';
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="btn btn-secondary btn-sm edit-btn" data-id="${bannerId}" data-type="banner" data-banner-type="${bannerType}"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${bannerId}" data-type="banner" data-banner-type="${bannerType}"><i class="fas fa-trash"></i> Delete</button>
            `;
        });
        console.log(`${bannerType} banners loaded successfully.`);
    } catch (error) {
        bannersTableBody.innerHTML = `<tr><td colspan="8">Error loading ${bannerType} banners. Check console.</td></tr>`;
        console.error(`Error loading ${bannerType} banners:`, error);
    }
}


async function loadSiteSettings() {
    console.log("loadSiteSettings called.");
    const siteNameInput = document.getElementById('site-name-input');
    const siteLogoUrlInput = document.getElementById('site-logo-url-input');
    const siteLogoPreviewImg = document.getElementById('site-logo-preview-img');
    
    const themeBackgroundInput = document.getElementById('theme-background-hsl-input');
    const themeForegroundInput = document.getElementById('theme-foreground-hsl-input');
    const themePrimaryInput = document.getElementById('theme-primary-hsl-input');
    const themeAccentInput = document.getElementById('theme-accent-hsl-input');


    if (!siteNameInput || !siteLogoUrlInput || !siteLogoPreviewImg || !themeBackgroundInput || !themeForegroundInput || !themePrimaryInput || !themeAccentInput) {
        console.warn("Site settings form elements not all found. Cannot load settings.");
        showToast("Error: Some site settings form elements are missing in the HTML.", "error");
        return;
    }
    console.log("All site settings form elements found.");

    try {
        const mainSettingsSnap = await firestoreRequest('getDoc', 'siteConfiguration', 'main');
        if (mainSettingsSnap.exists()) {
            const settings = mainSettingsSnap.data();
            console.log("Fetched siteConfiguration/main:", settings);
            siteNameInput.value = settings.name || '';
            siteLogoUrlInput.value = settings.logoUrl || '';
            if (settings.logoUrl) {
                siteLogoPreviewImg.src = settings.logoUrl;
                siteLogoPreviewImg.style.display = 'block';
            } else {
                siteLogoPreviewImg.style.display = 'none';
                siteLogoPreviewImg.src = '#';
            }
        } else {
            console.log("No 'main' site settings document found.");
            siteNameInput.value = 'Lab Price Compare'; // Default
            siteLogoUrlInput.value = '';
            siteLogoPreviewImg.style.display = 'none';
            siteLogoPreviewImg.src = '#';
        }

        const themeSettingsSnap = await firestoreRequest('getDoc', 'siteConfiguration', 'themeSettings');
        if (themeSettingsSnap.exists()) {
            const settings = themeSettingsSnap.data();
            console.log("Fetched siteConfiguration/themeSettings:", settings);
            themeBackgroundInput.value = settings.themeBackground || '';
            themeForegroundInput.value = settings.themeForeground || '';
            themePrimaryInput.value = settings.themePrimary || '';
            themeAccentInput.value = settings.themeAccent || '';
        } else {
            console.log("No 'themeSettings' document found.");
             // Populate with default theme values from globals.css for guidance
            themeBackgroundInput.value = '200 20% 98%'; 
            themeForegroundInput.value = '220 20% 25%';
            themePrimaryInput.value = '175 70% 40%';
            themeAccentInput.value = '45 90% 55%';
        }
         console.log("Site settings loaded successfully.");

    } catch (error) {
        console.error("Error loading site settings:", error);
        showToast("Failed to load site settings. " + error.message, "error");
    }
}


// ----- Form Submission Handlers -----
// Placeholder functions, to be fully implemented
async function handleAddLabFormSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('lab-name').value.trim();
    const location = document.getElementById('lab-location').value.trim();
    if (!name) {
        showToast("Lab name is required.", "error");
        return;
    }
    try {
        await firestoreRequest('addDoc', 'labs', null, { name, location });
        showToast("Lab added successfully!", "success");
        event.target.reset();
        loadLabs();
    } catch (error) {
        // Error already shown by firestoreRequest
    }
}

// ... other form submission handlers to be fully implemented ...
async function handleAddTestFormSubmit(event) {
    event.preventDefault();
    console.log("handleAddTestFormSubmit called");

    const testNameInput = document.getElementById('test-name-input');
    const descriptionInput = document.getElementById('test-description-input');
    const imageUrlInput = document.getElementById('test-image-url-input');
    const tagsInput = document.getElementById('test-tags-input');
    const isPopularInput = document.getElementById('test-is-popular-input');
    const isPackageInput = document.getElementById('test-is-package-input');
    const isActiveInput = document.getElementById('test-is-active-input');
    const bannerTextInput = document.getElementById('test-banner-text-input');

    if (!testNameInput || !descriptionInput || !imageUrlInput || !tagsInput || !isPopularInput || !isPackageInput || !isActiveInput || !bannerTextInput) {
        showToast("Error: One or more test form elements are missing in the HTML.", "error");
        console.error("Missing elements in add test form");
        return;
    }

    const testName = testNameInput.value.trim();
    const description = descriptionInput.value.trim();
    const imageUrl = imageUrlInput.value.trim();
    const tags = tagsInput.value.trim() ? tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const isPopular = isPopularInput.checked;
    const isPackage = isPackageInput.checked;
    const isActive = isActiveInput.checked;
    const bannerText = bannerTextInput.value.trim();

    if (!testName) {
        showToast("Test name is required.", "error");
        return;
    }

    // Lab Prices
    const labPrices = [];
    const labPriceRows = document.querySelectorAll('#lab-prices-container-add .lab-price-row');
    let pricesValid = true;
    labPriceRows.forEach(row => {
        const labId = row.querySelector('.lab-select').value;
        const price = parseFloat(row.querySelector('.price-input').value);
        const originalPrice = parseFloat(row.querySelector('.original-price-input').value);

        if (!labId) {
            showToast("Please select a lab for all price entries.", "error");
            pricesValid = false;
            return;
        }
        if (isNaN(price) || price < 0) {
            showToast("Please enter a valid price for all entries.", "error");
            pricesValid = false;
            return;
        }
        labPrices.push({ 
            labId, 
            price, 
            originalPrice: isNaN(originalPrice) || originalPrice < 0 ? null : originalPrice 
        });
    });

    if (!pricesValid) return;

    // Health Concerns
    const selectedHealthConcernSlugs = [];
    const healthConcernCheckboxes = document.querySelectorAll('#health-concerns-checkboxes-add input[type="checkbox"]:checked');
    healthConcernCheckboxes.forEach(checkbox => {
        selectedHealthConcernSlugs.push(checkbox.value);
    });

    const newTestData = {
        testName,
        description: description || null,
        imageUrl: imageUrl || null,
        tags,
        isPopular,
        isPackage,
        isActive,
        bannerText: bannerText || null,
        healthConcernSlugs: selectedHealthConcernSlugs,
        // createdAt and lastUpdatedAt will be handled by firestoreRequest
    };
    console.log("Saving new Test with data:", newTestData);
    console.log("Lab prices to save:", labPrices);

    try {
        const testDocRef = await firestoreRequest('addDoc', 'tests', null, newTestData);
        const testId = testDocRef.id;

        // Save lab prices to testLabPrices collection
        const pricePromises = labPrices.map(lp => {
            const lab = labsListCache.find(l => l.id === lp.labId);
            return firestoreRequest('addDoc', 'testLabPrices', null, {
                testId: testId,
                testName: testName, // Denormalized
                labId: lp.labId,
                labName: lab ? lab.name : 'Unknown Lab', // Denormalized
                price: lp.price,
                originalPrice: lp.originalPrice
            });
        });
        await Promise.all(pricePromises);

        showToast("Test and its prices added successfully!", "success");
        event.target.reset();
        document.getElementById('lab-prices-container-add').innerHTML = ''; // Clear dynamic rows
        document.getElementById('health-concerns-checkboxes-add').innerHTML = '<p>Loading health concerns...</p>'; // Reset
        populateHealthConcernsCheckboxes('health-concerns-checkboxes-add'); // Repopulate for next add
        const testImagePreviewImg = document.getElementById('test-image-preview-img');
        if(testImagePreviewImg) {
            testImagePreviewImg.style.display = 'none';
            testImagePreviewImg.src = '#';
        }
        loadTests();
    } catch (error) {
        console.error("Error adding test:", error);
        showToast("Error adding test. " + error.message, "error", 5000);
    }
}

async function handleAddHealthConcernFormSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById('hc-name-input');
    const orderInput = document.getElementById('hc-display-order-input');
    const iconUrlInput = document.getElementById('hc-icon-url-input');
    const isActiveCheckbox = document.getElementById('hc-is-active-checkbox');

    if (!nameInput || !orderInput || !iconUrlInput || !isActiveCheckbox) {
        showToast("Error: Health concern form elements are missing in the HTML.", "error");
        return;
    }

    const name = nameInput.value.trim();
    const order = parseInt(orderInput.value, 10);
    const iconUrl = iconUrlInput.value.trim();
    const isActive = isActiveCheckbox.checked;

    if (!name) {
        showToast("Health Concern name is required.", "error");
        return;
    }
    if (isNaN(order)) {
        showToast("Display order must be a number.", "error");
        return;
    }

    const slug = generateSlug(name);
    const newHcData = {
        name,
        slug,
        order,
        iconUrl: iconUrl || null,
        isActive,
        // createdAt and lastUpdatedAt will be handled by firestoreRequest
    };
    console.log("Saving new Health Concern with data:", newHcData);

    try {
        await firestoreRequest('addDoc', 'healthConcerns', null, newHcData);
        showToast("Health Concern added successfully!", "success");
        event.target.reset();
        const hcIconPreviewImg = document.getElementById('hc-icon-preview-img');
        if(hcIconPreviewImg) {
            hcIconPreviewImg.style.display = 'none';
            hcIconPreviewImg.src = '#';
        }
        loadHealthConcernsForAdmin();
    } catch (error) {
        // Error already shown by firestoreRequest
        console.error("Error adding health concern:", error);
    }
}


async function handleAddOfferFormSubmit(event) {
    event.preventDefault();
    const titleInput = document.getElementById('offer-title-input');
    const descriptionInput = document.getElementById('offer-description-input');
    const testIdInput = document.getElementById('offer-test-id-input');
    const discountPercentageInput = document.getElementById('offer-discount-percentage-input');
    const couponCodeInput = document.getElementById('offer-coupon-code-input');
    const startDateInput = document.getElementById('offer-start-date-input');
    const endDateInput = document.getElementById('offer-end-date-input');
    const isActiveInput = document.getElementById('offer-is-active-input');

    if (!titleInput || !descriptionInput || !testIdInput || !discountPercentageInput || !couponCodeInput || !startDateInput || !endDateInput || !isActiveInput) {
        showToast("Error: Offer form elements are missing in the HTML.", "error");
        return;
    }
    
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const testId = testIdInput.value;
    const discountPercentage = parseFloat(discountPercentageInput.value);
    const couponCode = couponCodeInput.value.trim();
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const isActive = isActiveInput.checked;

    if (!title || !testId || isNaN(discountPercentage) || !startDate || !endDate) {
        showToast("Title, Test, Discount Percentage, Start Date, and End Date are required.", "error");
        return;
    }
    if (discountPercentage < 0 || discountPercentage > 100) {
        showToast("Discount percentage must be between 0 and 100.", "error");
        return;
    }
    if (new Date(endDate) < new Date(startDate)) {
        showToast("End date cannot be before start date.", "error");
        return;
    }

    const newOfferData = {
        title,
        description: description || null,
        testId,
        discountPercentage,
        couponCode: couponCode || null,
        startDate, // Firestore will store as string, can convert to Timestamp on read if needed
        endDate,   // Firestore will store as string
        isActive,
        // createdAt and lastUpdatedAt handled by firestoreRequest
    };
    console.log("Saving new Offer with data:", newOfferData);

    try {
        await firestoreRequest('addDoc', 'offers', null, newOfferData);
        showToast("Offer added successfully!", "success");
        event.target.reset();
        loadOffers();
    } catch (error) {
         console.error("Error adding offer:", error);
    }
}

async function handleAddBannerFormSubmit(event, bannerType) {
    event.preventDefault();
    const prefix = bannerType === 'primary' ? 'primary-banner-' : 'secondary-banner-';
    const collectionName = bannerType === 'primary' ? 'promotionalBanners' : 'secondaryPromotionalBanners';

    const titleInput = document.getElementById(`${prefix}title-input`);
    const subtitleInput = document.getElementById(`${prefix}subtitle-input`);
    const iconNameInput = document.getElementById(`${prefix}icon-name-input`);
    const linkUrlInput = document.getElementById(`${prefix}link-url-input`);
    const imageUrlInput = document.getElementById(`${prefix}image-url-input`);
    const orderInput = document.getElementById(`${prefix}order-input`);
    const isActiveInput = document.getElementById(`${prefix}is-active-input`);

    if (!titleInput || !subtitleInput || !iconNameInput || !linkUrlInput || !imageUrlInput || !orderInput || !isActiveInput) {
        showToast(`Error: Some form elements for adding ${bannerType} banner are missing.`, "error");
        return;
    }

    const title = titleInput.value.trim();
    const subtitle = subtitleInput.value.trim();
    const iconName = iconNameInput.value.trim();
    const linkUrl = linkUrlInput.value.trim();
    const imageUrl = imageUrlInput.value.trim();
    const order = parseInt(orderInput.value, 10);
    const isActive = isActiveInput.checked;

    if (!title) {
        showToast("Banner title is required.", "error");
        return;
    }
    if (isNaN(order)) {
        showToast("Display order must be a number.", "error");
        return;
    }

    const newBannerData = {
        title,
        subtitle: subtitle || null,
        iconName: iconName || null,
        linkUrl: linkUrl || null,
        imageUrl: imageUrl || null,
        order,
        isActive,
        // createdAt, lastUpdatedAt by firestoreRequest
    };
    console.log(`Saving new ${bannerType} Banner with data:`, newBannerData);
    
    try {
        await firestoreRequest('addDoc', collectionName, null, newBannerData);
        showToast(`${bannerType.charAt(0).toUpperCase() + bannerType.slice(1)} banner added successfully!`, "success");
        event.target.reset();
        const previewImg = document.getElementById(`${prefix}image-preview-img`);
        if (previewImg) {
            previewImg.style.display = 'none';
            previewImg.src = '#';
        }
        loadBanners(bannerType);
    } catch (error) {
        console.error(`Error adding ${bannerType} banner:`, error);
    }
}

async function handleSiteSettingsFormSubmit(event) {
    event.preventDefault();
    const siteNameInput = document.getElementById('site-name-input');
    const siteLogoUrlInput = document.getElementById('site-logo-url-input');

    if (!siteNameInput || !siteLogoUrlInput) {
        showToast("Site settings form elements are missing.", "error");
        return;
    }
    
    const siteName = siteNameInput.value.trim();
    const logoUrl = siteLogoUrlInput.value.trim();

    if (!siteName) {
        showToast("Site name is required.", "error");
        return;
    }
    const siteSettingsData = {
        name: siteName,
        logoUrl: logoUrl || null,
    };
    console.log("Saving Site Settings (main):", siteSettingsData);

    try {
        await firestoreRequest('setDoc', 'siteConfiguration', 'main', siteSettingsData);
        showToast("Site settings updated successfully!", "success");
    } catch (error) {
        console.error("Error saving site settings:", error);
    }
}

async function handleThemeSettingsFormSubmit(event) {
    event.preventDefault();
    const bgInput = document.getElementById('theme-background-hsl-input');
    const fgInput = document.getElementById('theme-foreground-hsl-input');
    const primaryInput = document.getElementById('theme-primary-hsl-input');
    const accentInput = document.getElementById('theme-accent-hsl-input');

    if (!bgInput || !fgInput || !primaryInput || !accentInput) {
        showToast("Theme settings form elements are missing.", "error");
        return;
    }

    const themeSettingsData = {
        themeBackground: bgInput.value.trim() || null,
        themeForeground: fgInput.value.trim() || null,
        themePrimary: primaryInput.value.trim() || null,
        themeAccent: accentInput.value.trim() || null,
    };
    console.log("Saving Theme Settings:", themeSettingsData);
    try {
        await firestoreRequest('setDoc', 'siteConfiguration', 'themeSettings', themeSettingsData);
        showToast("Theme settings updated successfully! Refresh app to see changes.", "success", 5000);
    } catch (error) {
        console.error("Error saving theme settings:", error);
    }
}


// ----- Edit Modal Functions -----
// Placeholder functions, to be fully implemented
function openEditLabModal(labData, labId) {
    const modal = document.getElementById('edit-lab-modal');
    const form = document.getElementById('edit-lab-form-modal');
    const idInput = document.getElementById('edit-lab-id-modal-input');
    const nameInput = document.getElementById('edit-lab-name-modal-input');
    const locationInput = document.getElementById('edit-lab-location-modal-input');

    if (!modal || !form || !idInput || !nameInput || !locationInput) {
        console.warn("Edit lab modal elements not all found.");
        showToast("Error: Could not open edit lab form.", "error");
        return;
    }
    
    currentEditingLabId = labId;
    idInput.value = labId;
    nameInput.value = labData.name || '';
    locationInput.value = labData.location || '';
    openModal('edit-lab-modal');

    // Remove any previous event listener before adding
    form.onsubmit = null;
    form.addEventListener('submit', handleEditLabFormSubmit);
}

// ... other modal opening functions to be fully implemented ...
function openEditTestModal(testData, testId) {
    const modal = document.getElementById('edit-test-modal');
    const form = document.getElementById('edit-test-form-modal');
    const idInput = document.getElementById('edit-test-id-modal-input');
    const nameInput = document.getElementById('edit-test-name-modal-input');
    const descriptionInput = document.getElementById('edit-test-description-modal-input');
    const imageUrlInput = document.getElementById('edit-test-image-url-modal-input');
    const imagePreview = document.getElementById('edit-test-image-preview-modal-img');
    const tagsInput = document.getElementById('edit-test-tags-modal-input');
    const isPopularInput = document.getElementById('edit-test-is-popular-modal-input');
    const isPackageInput = document.getElementById('edit-test-is-package-modal-input');
    const isActiveInput = document.getElementById('edit-test-is-active-modal-input');
    const bannerTextInput = document.getElementById('edit-test-banner-text-modal-input');
    const labPricesContainerEdit = document.getElementById('lab-prices-container-edit');
    
    if (!modal || !form || !idInput || !nameInput || !descriptionInput || !imageUrlInput || !imagePreview || !tagsInput || !isPopularInput || !isPackageInput || !isActiveInput || !bannerTextInput || !labPricesContainerEdit ) {
        console.warn("Edit test modal elements not all found. Cannot open modal.", {modal, form, idInput, nameInput, descriptionInput, imageUrlInput, imagePreview, tagsInput, isPopularInput, isPackageInput, isActiveInput, bannerTextInput, labPricesContainerEdit});
        showToast("Error: Could not open edit test form.", "error");
        return;
    }

    currentEditingTestId = testId;
    idInput.value = testId;
    nameInput.value = testData.testName || '';
    descriptionInput.value = testData.description || '';
    imageUrlInput.value = testData.imageUrl || '';
    if (testData.imageUrl) {
        imagePreview.src = testData.imageUrl;
        imagePreview.style.display = 'block';
    } else {
        imagePreview.src = '#';
        imagePreview.style.display = 'none';
    }
    tagsInput.value = testData.tags ? testData.tags.join(', ') : '';
    isPopularInput.checked = testData.isPopular || false;
    isPackageInput.checked = testData.isPackage || false;
    isActiveInput.checked = testData.isActive === undefined ? true : testData.isActive; // Default to true
    bannerTextInput.value = testData.bannerText || '';

    // Populate health concerns checkboxes
    populateHealthConcernsCheckboxes('health-concerns-checkboxes-edit', testData.healthConcernSlugs || []);

    // Populate lab prices
    labPricesContainerEdit.innerHTML = ''; // Clear previous
    firestoreRequest('getDocs', 'testLabPrices', null, null, [{ type: 'where', field: 'testId', op: '==', value: testId }])
        .then(pricesSnapshot => {
            if (!pricesSnapshot.empty) {
                pricesSnapshot.forEach(priceDoc => {
                    addLabPriceRow(labPricesContainerEdit, priceDoc.data(), true, priceDoc.id);
                });
            } else {
                // Optionally add a blank row if no prices exist
                 addLabPriceRow(labPricesContainerEdit, null, true); 
            }
        })
        .catch(error => {
            console.error("Error fetching lab prices for edit modal:", error);
            showToast("Could not load lab prices for editing.", "error");
        });
    
    setupImageUpload('edit-test-image-file-modal-input', 'edit-test-image-url-modal-input', 'edit-test-image-preview-modal-img', 'edit-test-image-upload-btn-modal');
    openModal('edit-test-modal');

    // Remove any previous event listener before adding
    form.onsubmit = null;
    form.addEventListener('submit', handleEditTestFormSubmit);

    // Add event listener for 'Add Lab Price' button in edit modal
    const addLabPriceBtnEdit = document.getElementById('add-lab-price-row-btn-edit');
    if (addLabPriceBtnEdit && !addLabPriceBtnEdit._listenerAttached) {
        addLabPriceBtnEdit.addEventListener('click', () => addLabPriceRow(document.getElementById('lab-prices-container-edit'), null, true));
        addLabPriceBtnEdit._listenerAttached = true;
    }
}

function openEditHealthConcernModal(hcData, hcId) {
    const modal = document.getElementById('edit-health-concern-modal');
    const form = document.getElementById('edit-health-concern-form-modal');
    const idInput = document.getElementById('edit-hc-id-modal-input');
    const nameInput = document.getElementById('edit-hc-name-modal-input');
    const orderInput = document.getElementById('edit-hc-display-order-modal-input');
    const iconUrlInput = document.getElementById('edit-hc-icon-url-modal-input');
    const iconPreview = document.getElementById('edit-hc-icon-preview-modal-img');
    const isActiveCheckbox = document.getElementById('edit-hc-is-active-modal-checkbox');

    if (!modal || !form || !idInput || !nameInput || !orderInput || !iconUrlInput || !iconPreview || !isActiveCheckbox) {
        console.warn("Edit Health Concern modal elements not all found.");
        showToast("Error: Could not open edit health concern form.", "error");
        return;
    }
    
    currentEditingHcId = hcId;
    idInput.value = hcId;
    nameInput.value = hcData.name || '';
    orderInput.value = hcData.order !== undefined ? hcData.order : 0;
    iconUrlInput.value = hcData.iconUrl || '';
    if (hcData.iconUrl) {
        iconPreview.src = hcData.iconUrl;
        iconPreview.style.display = 'block';
    } else {
        iconPreview.src = '#';
        iconPreview.style.display = 'none';
    }
    isActiveCheckbox.checked = hcData.isActive || false;

    setupImageUpload('edit-hc-icon-file-modal-input', 'edit-hc-icon-url-modal-input', 'edit-hc-icon-preview-modal-img', 'edit-hc-icon-upload-btn-modal');
    openModal('edit-health-concern-modal');

    // Remove any previous event listener before adding
    form.onsubmit = null;
    form.addEventListener('submit', handleEditHealthConcernFormSubmit);
}


function openEditOfferModal(offerData, offerId) {
    const modal = document.getElementById('edit-offer-modal');
    const form = document.getElementById('edit-offer-form-modal');
    const idInput = document.getElementById('edit-offer-id-modal-input');
    const titleInput = document.getElementById('edit-offer-title-modal-input');
    const descriptionInput = document.getElementById('edit-offer-description-modal-input');
    const testSelect = document.getElementById('edit-offer-test-id-modal-input');
    const discountInput = document.getElementById('edit-offer-discount-percentage-modal-input');
    const couponInput = document.getElementById('edit-offer-coupon-code-modal-input');
    const startDateInput = document.getElementById('edit-offer-start-date-modal-input');
    const endDateInput = document.getElementById('edit-offer-end-date-modal-input');
    const isActiveInput = document.getElementById('edit-offer-is-active-modal-input');

    if (!modal || !form || !idInput || !titleInput || !descriptionInput || !testSelect || !discountInput || !couponInput || !startDateInput || !endDateInput || !isActiveInput) {
        console.warn("Edit Offer modal elements not all found.");
        showToast("Error: Could not open edit offer form.", "error");
        return;
    }

    currentEditingOfferId = offerId;
    idInput.value = offerId;
    titleInput.value = offerData.title || '';
    descriptionInput.value = offerData.description || '';
    discountInput.value = offerData.discountPercentage !== undefined ? offerData.discountPercentage : '';
    couponInput.value = offerData.couponCode || '';
    startDateInput.value = offerData.startDate || '';
    endDateInput.value = offerData.endDate || '';
    isActiveInput.checked = offerData.isActive || false;
    
    loadTestsForOfferForm(testSelect, offerData.testId); // Populate and select
    openModal('edit-offer-modal');
}

function openUpdatePrescriptionStatusModal(prescriptionData, prescriptionId) {
    const modal = document.getElementById('update-prescription-status-modal');
    const idInput = document.getElementById('update-prescription-id-modal-input');
    const userNameDisplay = document.getElementById('prescription-user-name-modal-display');
    const statusSelect = document.getElementById('prescription-status-modal-select');
    const form = document.getElementById('update-prescription-status-form-modal');

    if (!modal || !idInput || !userNameDisplay || !statusSelect || !form) {
        console.warn("Update prescription status modal elements not found.");
        showToast("Error: Could not open update status form.", "error");
        return;
    }
    currentEditingPrescriptionId = prescriptionId;
    idInput.value = prescriptionId;
    userNameDisplay.textContent = prescriptionData.userName || 'Unknown User';
    statusSelect.value = prescriptionData.status || 'Pending Review';
    openModal('update-prescription-status-modal');

    // Remove any previous event listener before adding
    form.onsubmit = null;
    form.addEventListener('submit', handleUpdatePrescriptionStatusFormSubmit);
}

function openUserBookingsModal(userId, username) {
    const modal = document.getElementById('user-bookings-modal');
    const usernameDisplay = document.getElementById('user-bookings-modal-username');
    const contentDiv = document.getElementById('user-bookings-modal-content');

    if (!modal || !usernameDisplay || !contentDiv) {
        console.warn("User bookings modal elements not found.");
        showToast("Error: Could not open user bookings view.", "error");
        return;
    }

    usernameDisplay.textContent = username;
    contentDiv.innerHTML = '<p>Loading booking history...</p>';
    openModal('user-bookings-modal');

    firestoreRequest('getDocs', 'bookings', null, null, [
        { type: 'where', field: 'userId', op: '==', value: userId },
        { type: 'orderBy', field: 'bookingDate', direction: 'desc' }
    ])
    .then(snapshot => {
        if (snapshot.empty) {
            contentDiv.innerHTML = '<p>No booking history found for this user.</p>';
            return;
        }
        let tableHtml = `<table class="compact-table">
                            <thead>
                                <tr>
                                    <th>Booking ID</th>
                                    <th>Date</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Items</th>
                                </tr>
                            </thead>
                            <tbody>`;
        snapshot.forEach(doc => {
            const booking = doc.data();
            let itemsHtml = '<ul>';
            if (booking.items && booking.items.length > 0) {
                booking.items.forEach(item => {
                    itemsHtml += `<li>${item.testName} (${item.labName}) - ₹${item.price.toFixed(2)}</li>`;
                });
            } else {
                itemsHtml += '<li>No items</li>';
            }
            itemsHtml += '</ul>';

            tableHtml += `<tr>
                            <td>${doc.id}</td>
                            <td>${booking.bookingDate ? booking.bookingDate.toDate().toLocaleString() : 'N/A'}</td>
                            <td>₹${booking.totalAmount !== undefined ? booking.totalAmount.toFixed(2) : '0.00'}</td>
                            <td>${booking.status || 'N/A'}</td>
                            <td>${itemsHtml}</td>
                          </tr>`;
        });
        tableHtml += '</tbody></table>';
        contentDiv.innerHTML = tableHtml;
    })
    .catch(error => {
        console.error("Error fetching user bookings for modal:", error);
        contentDiv.innerHTML = `<p>Error loading booking history: ${error.message}</p>`;
    });
}

function openEditBannerModal(bannerData, bannerId, bannerType) {
    const modal = document.getElementById('edit-banner-modal');
    const form = document.getElementById('edit-banner-form-modal');
    const idInput = document.getElementById('edit-banner-id-modal-input');
    const typeInput = document.getElementById('edit-banner-type-modal-input');
    const titleInput = document.getElementById('edit-banner-title-modal-input');
    const subtitleInput = document.getElementById('edit-banner-subtitle-modal-input');
    const iconNameInput = document.getElementById('edit-banner-icon-name-modal-input');
    const linkUrlInput = document.getElementById('edit-banner-link-url-modal-input');
    const imageUrlInput = document.getElementById('edit-banner-image-url-modal-input');
    const imagePreview = document.getElementById('edit-banner-image-preview-modal-img');
    const orderInput = document.getElementById('edit-banner-order-modal-input');
    const isActiveInput = document.getElementById('edit-banner-is-active-modal-input');

    if (!modal || !form || !idInput || !typeInput || !titleInput || !subtitleInput || !iconNameInput || !linkUrlInput || !imageUrlInput || !imagePreview || !orderInput || !isActiveInput) {
        console.warn("Edit Banner modal elements not all found.");
        showToast("Error: Could not open edit banner form.", "error");
        return;
    }

    currentEditingBannerId = bannerId;
    currentEditingBannerType = bannerType; // 'primary' or 'secondary'

    idInput.value = bannerId;
    typeInput.value = bannerType;
    titleInput.value = bannerData.title || '';
    subtitleInput.value = bannerData.subtitle || '';
    iconNameInput.value = bannerData.iconName || '';
    linkUrlInput.value = bannerData.linkUrl || '';
    imageUrlInput.value = bannerData.imageUrl || '';
    if (bannerData.imageUrl) {
        imagePreview.src = bannerData.imageUrl;
        imagePreview.style.display = 'block';
    } else {
        imagePreview.src = '#';
        imagePreview.style.display = 'none';
    }
    orderInput.value = bannerData.order !== undefined ? bannerData.order : 0;
    isActiveInput.checked = bannerData.isActive || false;

    setupImageUpload('edit-banner-image-file-modal-input', 'edit-banner-image-url-modal-input', 'edit-banner-image-preview-modal-img', 'edit-banner-image-upload-btn-modal');
    openModal('edit-banner-modal');

    // Remove any previous event listener before adding
    form.onsubmit = null;
    form.addEventListener('submit', handleEditBannerFormSubmit);
}


// ----- Edit Form Submission Handlers -----
// Placeholder functions, to be fully implemented
async function handleEditLabFormSubmit(event) {
    event.preventDefault();
    if (!currentEditingLabId) {
        showToast("No lab selected for editing.", "error");
        return;
    }
    const nameInput = document.getElementById('edit-lab-name-modal-input');
    const locationInput = document.getElementById('edit-lab-location-modal-input');

    if (!nameInput || !locationInput) {
        showToast("Edit lab form elements missing.", "error");
        return;
    }
    const name = nameInput.value.trim();
    const location = locationInput.value.trim();

    if (!name) {
        showToast("Lab name is required.", "error");
        return;
    }
    try {
        await firestoreRequest('updateDoc', 'labs', currentEditingLabId, { name, location });
        showToast("Lab updated successfully!", "success");
        closeModal('edit-lab-modal');
        loadLabs();
    } catch (error) {
        // Error already shown
    }
}

// ... other edit form submission handlers to be fully implemented ...
async function handleEditTestFormSubmit(event) {
    event.preventDefault();
    console.log('Edit Test form submitted');
    if (!currentEditingTestId) {
        showToast("No test selected for update. Please close and reopen the edit form.", "error");
        console.error("currentEditingTestId is null or undefined in handleEditTestFormSubmit");
        return;
    }
    
    const nameInput = document.getElementById('edit-test-name-modal-input');
    const descriptionInput = document.getElementById('edit-test-description-modal-input');
    const imageUrlInput = document.getElementById('edit-test-image-url-modal-input');
    const tagsInput = document.getElementById('edit-test-tags-modal-input');
    const isPopularInput = document.getElementById('edit-test-is-popular-modal-input');
    const isPackageInput = document.getElementById('edit-test-is-package-modal-input');
    const isActiveInput = document.getElementById('edit-test-is-active-modal-input');
    const bannerTextInput = document.getElementById('edit-test-banner-text-modal-input');

    if (!nameInput || !descriptionInput || !imageUrlInput || !tagsInput || !isPopularInput || !isPackageInput || !isActiveInput || !bannerTextInput) {
        showToast("Error: One or more edit test form elements are missing in the HTML.", "error");
        console.error("Missing elements in edit test form modal.");
        return;
    }

    const testName = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    const imageUrl = imageUrlInput.value.trim();
    const tags = tagsInput.value.trim() ? tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const isPopular = isPopularInput.checked;
    const isPackage = isPackageInput.checked;
    const isActive = isActiveInput.checked;
    const bannerText = bannerTextInput.value.trim();

    if (!testName) {
        showToast("Test name is required.", "error");
        return;
    }

    // Lab Prices
    const labPricesData = [];
    const labPriceRowsEdit = document.querySelectorAll('#lab-prices-container-edit .lab-price-row');
    let pricesValid = true;
    labPriceRowsEdit.forEach(row => {
        const labId = row.querySelector('.lab-select').value;
        const price = parseFloat(row.querySelector('.price-input').value);
        const originalPrice = parseFloat(row.querySelector('.original-price-input').value);
        const priceEntryId = row.dataset.priceEntryId; // existing price ID, if any

        if (!labId) {
            showToast("Please select a lab for all price entries.", "error");
            pricesValid = false; return;
        }
        if (isNaN(price) || price < 0) {
            showToast("Please enter a valid price for all entries.", "error");
            pricesValid = false; return;
        }
        labPricesData.push({ 
            labId, 
            price, 
            originalPrice: isNaN(originalPrice) || originalPrice < 0 ? null : originalPrice,
            priceEntryId: priceEntryId || null // null if new
        });
    });
    if (!pricesValid) return;

    // Health Concerns
    const selectedHealthConcernSlugs = [];
    const healthConcernCheckboxesEdit = document.querySelectorAll('#health-concerns-checkboxes-edit input[type="checkbox"]:checked');
    healthConcernCheckboxesEdit.forEach(checkbox => {
        selectedHealthConcernSlugs.push(checkbox.value);
    });

    const updatedTestData = {
        testName,
        description: description || null,
        imageUrl: imageUrl || null,
        tags,
        isPopular,
        isPackage,
        isActive,
        bannerText: bannerText || null,
        healthConcernSlugs: selectedHealthConcernSlugs,
        // lastUpdatedAt will be handled by firestoreRequest
    };
    console.log(`Updating Test (ID: ${currentEditingTestId}) with data:`, updatedTestData);
    console.log("Lab prices to update/add:", labPricesData);

    try {
        await firestoreRequest('updateDoc', 'tests', currentEditingTestId, updatedTestData);

        // Handle lab prices: update existing, add new, delete removed
        const existingPricesSnapshot = await firestoreRequest('getDocs', 'testLabPrices', null, null, [{ type: 'where', field: 'testId', op: '==', value: currentEditingTestId }]);
        const existingPriceIds = existingPricesSnapshot.docs.map(doc => doc.id);
        const newPriceIds = [];

        const pricePromises = labPricesData.map(async (lpData) => {
            const lab = labsListCache.find(l => l.id === lpData.labId);
            const priceEntry = {
                testId: currentEditingTestId,
                testName: testName,
                labId: lpData.labId,
                labName: lab ? lab.name : 'Unknown Lab',
                price: lpData.price,
                originalPrice: lpData.originalPrice
            };
            if (lpData.priceEntryId && existingPriceIds.includes(lpData.priceEntryId)) { // Update existing
                newPriceIds.push(lpData.priceEntryId);
                return firestoreRequest('updateDoc', 'testLabPrices', lpData.priceEntryId, priceEntry);
            } else { // Add new
                const newPriceDocRef = await firestoreRequest('addDoc', 'testLabPrices', null, priceEntry);
                newPriceIds.push(newPriceDocRef.id);
                return newPriceDocRef;
            }
        });
        await Promise.all(pricePromises);

        // Delete prices that were removed in the UI
        const pricesToDelete = existingPriceIds.filter(id => !newPriceIds.includes(id));
        const deletePromises = pricesToDelete.map(id => firestoreRequest('deleteDoc', 'testLabPrices', id));
        await Promise.all(deletePromises);


        showToast("Test and its prices updated successfully!", "success");
        closeModal('edit-test-modal');
        loadTests();
    } catch (error) {
        console.error("Error updating test:", error);
        // Toast already shown by firestoreRequest if it's a Firestore error
    }
}

async function handleEditHealthConcernFormSubmit(event) {
    event.preventDefault();
    if (!currentEditingHcId) {
        showToast("No Health Concern selected for editing.", "error");
        return;
    }

    const nameInput = document.getElementById('edit-hc-name-modal-input');
    const orderInput = document.getElementById('edit-hc-display-order-modal-input');
    const iconUrlInput = document.getElementById('edit-hc-icon-url-modal-input');
    const isActiveCheckbox = document.getElementById('edit-hc-is-active-modal-checkbox');

    if (!nameInput || !orderInput || !iconUrlInput || !isActiveCheckbox) {
        showToast("Error: Edit health concern form elements are missing.", "error");
        return;
    }
    
    const name = nameInput.value.trim();
    const order = parseInt(orderInput.value, 10);
    const iconUrl = iconUrlInput.value.trim();
    const isActive = isActiveCheckbox.checked;

    if (!name) {
        showToast("Health Concern name is required.", "error");
        return;
    }
     if (isNaN(order)) {
        showToast("Display order must be a number.", "error");
        return;
    }

    const slug = generateSlug(name);
    const updatedHcData = {
        name,
        slug,
        order,
        iconUrl: iconUrl || null,
        isActive,
        // lastUpdatedAt handled by firestoreRequest
    };
    console.log("Updating Health Concern (ID: " + currentEditingHcId + ") with data:", updatedHcData);

    try {
        await firestoreRequest('updateDoc', 'healthConcerns', currentEditingHcId, updatedHcData);
        showToast("Health Concern updated successfully!", "success");
        closeModal('edit-health-concern-modal');
        loadHealthConcernsForAdmin();
    } catch (error) {
        console.error("Error updating health concern:", error);
    }
}

async function handleEditOfferFormSubmit(event) {
    event.preventDefault();
    if (!currentEditingOfferId) {
        showToast("No offer selected for editing.", "error");
        return;
    }
    const titleInput = document.getElementById('edit-offer-title-modal-input');
    const descriptionInput = document.getElementById('edit-offer-description-modal-input');
    const testIdInput = document.getElementById('edit-offer-test-id-modal-input');
    const discountPercentageInput = document.getElementById('edit-offer-discount-percentage-modal-input');
    const couponCodeInput = document.getElementById('edit-offer-coupon-code-modal-input');
    const startDateInput = document.getElementById('edit-offer-start-date-modal-input');
    const endDateInput = document.getElementById('edit-offer-end-date-modal-input');
    const isActiveInput = document.getElementById('edit-offer-is-active-modal-input');

    if (!titleInput || !descriptionInput || !testIdInput || !discountPercentageInput || !couponCodeInput || !startDateInput || !endDateInput || !isActiveInput) {
        showToast("Error: Edit offer form elements are missing.", "error");
        return;
    }
    
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const testId = testIdInput.value;
    const discountPercentage = parseFloat(discountPercentageInput.value);
    const couponCode = couponCodeInput.value.trim();
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const isActive = isActiveInput.checked;

    if (!title || !testId || isNaN(discountPercentage) || !startDate || !endDate) {
        showToast("Title, Test, Discount, Start Date, and End Date are required.", "error");
        return;
    }
    if (new Date(endDate) < new Date(startDate)) {
        showToast("End date cannot be before start date.", "error");
        return;
    }

    const updatedOfferData = {
        title,
        description: description || null,
        testId,
        discountPercentage,
        couponCode: couponCode || null,
        startDate,
        endDate,
        isActive,
        // lastUpdatedAt by firestoreRequest
    };
    console.log("Updating Offer (ID: " + currentEditingOfferId + ") with data:", updatedOfferData);
    try {
        await firestoreRequest('updateDoc', 'offers', currentEditingOfferId, updatedOfferData);
        showToast("Offer updated successfully!", "success");
        closeModal('edit-offer-modal');
        loadOffers();
    } catch (error) {
        console.error("Error updating offer:", error);
    }
}

async function handleUpdatePrescriptionStatusFormSubmit(event) {
    event.preventDefault();
    console.log('Update Prescription Status form submitted');
    if (!currentEditingPrescriptionId) {
        showToast("No prescription selected for status update.", "error");
        return;
    }
    const statusSelect = document.getElementById('prescription-status-modal-select');
    if (!statusSelect) {
        showToast("Status select element not found in modal.", "error");
        return;
    }
    const newStatus = statusSelect.value;
    try {
        await firestoreRequest('updateDoc', 'prescriptions', currentEditingPrescriptionId, { status: newStatus });
        showToast("Prescription status updated successfully!", "success");
        closeModal('update-prescription-status-modal');
        loadPrescriptions();
    } catch (error) {
        console.error("Error updating prescription status:", error);
        showToast('Error updating prescription status: ' + error.message, 'error');
    }
}

async function handleEditBannerFormSubmit(event) {
    event.preventDefault();
    if (!currentEditingBannerId || !currentEditingBannerType) {
        showToast("No banner selected for editing or banner type is missing.", "error");
        return;
    }
    const collectionName = currentEditingBannerType === 'primary' ? 'promotionalBanners' : 'secondaryPromotionalBanners';

    const titleInput = document.getElementById('edit-banner-title-modal-input');
    const subtitleInput = document.getElementById('edit-banner-subtitle-modal-input');
    const iconNameInput = document.getElementById('edit-banner-icon-name-modal-input');
    const linkUrlInput = document.getElementById('edit-banner-link-url-modal-input');
    const imageUrlInput = document.getElementById('edit-banner-image-url-modal-input');
    const orderInput = document.getElementById('edit-banner-order-modal-input');
    const isActiveInput = document.getElementById('edit-banner-is-active-modal-input');

    if (!titleInput || !subtitleInput || !iconNameInput || !linkUrlInput || !imageUrlInput || !orderInput || !isActiveInput) {
        showToast("Error: Edit banner form elements are missing.", "error");
        return;
    }

    const title = titleInput.value.trim();
    const subtitle = subtitleInput.value.trim();
    const iconName = iconNameInput.value.trim();
    const linkUrl = linkUrlInput.value.trim();
    const imageUrl = imageUrlInput.value.trim();
    const order = parseInt(orderInput.value, 10);
    const isActive = isActiveInput.checked;

    if (!title) {
        showToast("Banner title is required.", "error");
        return;
    }
     if (isNaN(order)) {
        showToast("Display order must be a number.", "error");
        return;
    }

    const updatedBannerData = {
        title,
        subtitle: subtitle || null,
        iconName: iconName || null,
        linkUrl: linkUrl || null,
        imageUrl: imageUrl || null,
        order,
        isActive,
        // lastUpdatedAt by firestoreRequest
    };
    console.log(`Updating ${currentEditingBannerType} Banner (ID: ${currentEditingBannerId}) with data:`, updatedBannerData);

    try {
        await firestoreRequest('updateDoc', collectionName, currentEditingBannerId, updatedBannerData);
        showToast(`${currentEditingBannerType.charAt(0).toUpperCase() + currentEditingBannerType.slice(1)} banner updated successfully!`, "success");
        closeModal('edit-banner-modal');
        loadBanners(currentEditingBannerType);
    } catch (error) {
        console.error(`Error updating ${currentEditingBannerType} banner:`, error);
    }
}


// ----- Delete Functions -----
// Placeholder functions, to be fully implemented
async function deleteItem(itemId, itemType, bannerTypeIfBanner = null) {
    let collectionName = '';
    let itemName = itemType;
    if (itemType === 'lab') collectionName = 'labs';
    else if (itemType === 'test') collectionName = 'tests';
    else if (itemType === 'healthConcern') collectionName = 'healthConcerns';
    else if (itemType === 'offer') collectionName = 'offers';
    // Prescriptions are not typically deleted by admin, only status updated.
    // Users are not typically deleted by admin directly from this panel.
    else if (itemType === 'banner') {
        collectionName = bannerTypeIfBanner === 'primary' ? 'promotionalBanners' : 'secondaryPromotionalBanners';
        itemName = `${bannerTypeIfBanner} banner`;
    }
    else {
        showToast(`Unknown item type for deletion: ${itemType}`, "error");
        return;
    }

    if (!confirm(`Are you sure you want to delete this ${itemName} (ID: ${itemId})? This action cannot be undone.`)) {
        return;
    }

    try {
        await firestoreRequest('deleteDoc', collectionName, itemId);
        
        // If deleting a test, also delete its associated lab prices and references in offers
        if (itemType === 'test') {
            const pricesSnapshot = await firestoreRequest('getDocs', 'testLabPrices', null, null, [{ type: 'where', field: 'testId', op: '==', value: itemId }]);
            const priceDeletePromises = pricesSnapshot.docs.map(doc => firestoreRequest('deleteDoc', 'testLabPrices', doc.id));
            await Promise.all(priceDeletePromises);
            showToast("Associated lab prices also deleted.", "info");

            // Remove testId from offers or delete offers for this test
            const offersSnapshot = await firestoreRequest('getDocs', 'offers', null, null, [{ type: 'where', field: 'testId', op: '==', value: itemId }]);
            const offerDeletePromises = offersSnapshot.docs.map(doc => firestoreRequest('deleteDoc', 'offers', doc.id)); // Or update to nullify testId
            await Promise.all(offerDeletePromises);
            if (offersSnapshot.docs.length > 0) showToast("Associated offers also deleted.", "info");
        }
        // If deleting a health concern, consider how to handle it in tests (e.g., remove from healthConcernSlugs array in tests)
        // This part can be complex and might require iterating over all tests. For now, manual cleanup in tests might be needed or a backend function.

        showToast(`${itemName.charAt(0).toUpperCase() + itemName.slice(1)} deleted successfully!`, "success");
        
        // Reload relevant data
        if (itemType === 'lab') loadLabs();
        else if (itemType === 'test') loadTests();
        else if (itemType === 'healthConcern') loadHealthConcernsForAdmin();
        else if (itemType === 'offer') loadOffers();
        else if (itemType === 'banner') loadBanners(bannerTypeIfBanner);

    } catch (error) {
        console.error(`Error deleting ${itemName}:`, error);
    }
}


// ----- Dynamic UI Helper Functions -----
function addLabPriceRow(containerElement, labPriceData = null, isEdit = false, priceEntryId = null) {
    if (!containerElement) {
        console.warn("Lab prices container not found for adding row.");
        return;
    }
    if (labsListCache.length === 0) {
        showToast("Labs not loaded yet. Please wait or load labs first.", "info");
        // Potentially call loadLabs here if it's safe and makes sense
        return;
    }

    const rowDiv = document.createElement('div');
    rowDiv.classList.add('lab-price-row', 'form-group-row');
    if (priceEntryId) {
        rowDiv.dataset.priceEntryId = priceEntryId; // Store existing price entry ID for updates
    }

    const labSelect = document.createElement('select');
    labSelect.classList.add('lab-select');
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Select Lab";
    labSelect.appendChild(defaultOption);

    labsListCache.forEach(lab => {
        const option = document.createElement('option');
        option.value = lab.id;
        option.textContent = lab.name;
        if (labPriceData && labPriceData.labId === lab.id) {
            option.selected = true;
        }
        labSelect.appendChild(option);
    });

    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.classList.add('price-input');
    priceInput.placeholder = 'Price (e.g., 150)';
    priceInput.value = labPriceData && labPriceData.price !== undefined ? labPriceData.price : '';
    priceInput.min = "0"; priceInput.step = "0.01";


    const originalPriceInput = document.createElement('input');
    originalPriceInput.type = 'number';
    originalPriceInput.classList.add('original-price-input');
    originalPriceInput.placeholder = 'MRP (Optional)';
    originalPriceInput.value = labPriceData && labPriceData.originalPrice !== undefined ? labPriceData.originalPrice : '';
    originalPriceInput.min = "0"; originalPriceInput.step = "0.01";

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.classList.add('btn', 'btn-danger', 'btn-sm', 'remove-lab-price-btn');
    removeBtn.innerHTML = '<i class="fas fa-times"></i> Remove';
    removeBtn.onclick = () => rowDiv.remove();

    rowDiv.appendChild(labSelect);
    rowDiv.appendChild(priceInput);
    rowDiv.appendChild(originalPriceInput);
    rowDiv.appendChild(removeBtn);
    containerElement.appendChild(rowDiv);
}

function populateHealthConcernsCheckboxes(containerId, existingSlugs = []) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Health concerns container ('${containerId}') not found for checkboxes.`);
        return;
    }
    if (!dbInstance || !firebaseFirestoreFunctions || !firebaseFirestoreFunctions.collection) {
        console.warn("Health concerns container or Firestore functions not available for checkboxes.");
        container.innerHTML = '<p>Error: Firestore service not available for loading health concerns.</p>';
        return;
    }
    
    container.innerHTML = '<p>Loading health concerns...</p>'; // Loading state

    if (healthConcernsListCache.length > 0) {
        renderHcCheckboxes(container, healthConcernsListCache, existingSlugs);
    } else {
        // Fetch if cache is empty
        firestoreRequest('getDocs', 'healthConcerns', null, null, [{ type: 'orderBy', field: 'name' }])
            .then(snapshot => {
                healthConcernsListCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderHcCheckboxes(container, healthConcernsListCache, existingSlugs);
            })
            .catch(error => {
                console.error("Error fetching health concerns for checkboxes:", error);
                container.innerHTML = '<p>Could not load health concerns.</p>';
            });
    }
}

function renderHcCheckboxes(container, concerns, existingSlugs) {
    container.innerHTML = ''; // Clear loading or previous
    if (concerns.length === 0) {
        container.innerHTML = '<p>No health concerns defined yet. Add them in "Manage Health Concerns" tab.</p>';
        return;
    }
    concerns.forEach(hc => {
        const div = document.createElement('div');
        div.classList.add('checkbox-item');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `hc-checkbox-${container.id}-${hc.slug}`;
        checkbox.value = hc.slug;
        if (existingSlugs.includes(hc.slug)) {
            checkbox.checked = true;
        }
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = hc.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        container.appendChild(div);
    });
}


function loadTestsForOfferForm(selectElementId, selectedTestId = null) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) {
        console.warn(`Select element ('${selectElementId}') for tests not found for offer form.`);
        return;
    }
    selectElement.innerHTML = '<option value="">Loading tests...</option>';

    if (testsListCache.length > 0) {
        populateTestSelect(selectElement, testsListCache, selectedTestId);
    } else {
        firestoreRequest('getDocs', 'tests', null, null, [{ type: 'where', field: 'isActive', op: '==', value: true }, { type: 'orderBy', field: 'testName' }])
            .then(snapshot => {
                const tests = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().testName }));
                testsListCache = tests; // Cache for future use if it wasn't populated
                populateTestSelect(selectElement, tests, selectedTestId);
            })
            .catch(error => {
                console.error("Error loading tests for offer form:", error);
                selectElement.innerHTML = '<option value="">Could not load tests</option>';
            });
    }
}

function populateTestSelect(selectElement, tests, selectedTestId) {
    selectElement.innerHTML = '<option value="">Select a Test</option>'; // Clear loading and add default
    if (tests.length === 0) {
        selectElement.innerHTML = '<option value="">No active tests available</option>';
        return;
    }
    tests.forEach(test => {
        const option = document.createElement('option');
        option.value = test.id;
        option.textContent = test.name;
        if (selectedTestId && test.id === selectedTestId) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}


// ----- Excel Import/Export -----
async function exportTestsToExcel() {
    showToast("Preparing Excel export... This may take a moment.", "info", 5000);
    try {
        const testsSnapshot = await firestoreRequest('getDocs', 'tests', null, null, [{ type: 'orderBy', field: 'testName' }]);
        const excelData = [];

        for (const testDoc of testsSnapshot.docs) {
            const testData = testDoc.data();
            const testId = testDoc.id;

            const pricesSnapshot = await firestoreRequest('getDocs', 'testLabPrices', null, null, [{ type: 'where', field: 'testId', op: '==', value: testId }]);
            
            if (pricesSnapshot.empty) {
                excelData.push({
                    "Test Name": testData.testName,
                    "Description": testData.description || '',
                    "Image URL": testData.imageUrl || '',
                    "Tags": testData.tags ? testData.tags.join(', ') : '',
                    "Is Popular": testData.isPopular ? 'TRUE' : 'FALSE',
                    "Is Package": testData.isPackage ? 'TRUE' : 'FALSE',
                    "Is Active": testData.isActive === false ? 'FALSE' : 'TRUE',
                    "Banner Text": testData.bannerText || '',
                    "Health Concern Slugs": testData.healthConcernSlugs ? testData.healthConcernSlugs.join(', ') : '',
                    "Lab Name": 'N/A',
                    "Price": 'N/A',
                    "Original Price": 'N/A'
                });
            } else {
                pricesSnapshot.forEach(priceDoc => {
                    const priceData = priceDoc.data();
                    excelData.push({
                        "Test Name": testData.testName,
                        "Description": testData.description || '',
                        "Image URL": testData.imageUrl || '',
                        "Tags": testData.tags ? testData.tags.join(', ') : '',
                        "Is Popular": testData.isPopular ? 'TRUE' : 'FALSE',
                        "Is Package": testData.isPackage ? 'TRUE' : 'FALSE',
                        "Is Active": testData.isActive === false ? 'FALSE' : 'TRUE',
                        "Banner Text": testData.bannerText || '',
                        "Health Concern Slugs": testData.healthConcernSlugs ? testData.healthConcernSlugs.join(', ') : '',
                        "Lab Name": priceData.labName || '',
                        "Price": priceData.price !== undefined ? priceData.price : '',
                        "Original Price": priceData.originalPrice !== undefined ? priceData.originalPrice : ''
                    });
                });
            }
        }

        if (excelData.length === 0) {
            showToast("No test data to export.", "info");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Tests");
        XLSX.writeFile(workbook, "LabTestsExport.xlsx");
        showToast("Tests exported successfully!", "success");

    } catch (error) {
        console.error("Error exporting tests to Excel:", error);
        showToast("Failed to export tests to Excel. " + error.message, "error");
    }
}

async function handleExcelImport(file) {
    if (!file) {
        showToast("No Excel file selected.", "error");
        return;
    }
    showToast("Processing Excel file... This may take a moment.", "info", 10000);

    // Ensure labsListCache is populated for mapping lab names to IDs
    if (labsListCache.length === 0) {
        try {
            const labsSnapshot = await firestoreRequest('getDocs', 'labs', null, null, [{ type: 'orderBy', field: 'name' }]);
            labsListCache = labsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
            if (labsListCache.length === 0) {
                 showToast("No labs found in the database. Please add labs before importing tests with prices.", "error", 7000);
                 return;
            }
        } catch (error) {
            showToast("Could not load labs for Excel import. " + error.message, "error");
            return;
        }
    }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) { // Header + at least one data row
                showToast("Excel file is empty or has no data rows.", "error");
                return;
            }

            const headers = jsonData[0].map(h => String(h).trim());
            const requiredHeaders = ["Test Name", "Lab Name", "Price"];
            for (const reqHeader of requiredHeaders) {
                if (!headers.includes(reqHeader)) {
                    showToast(`Missing required header in Excel: "${reqHeader}".`, "error", 7000);
                    return;
                }
            }
            
            const headerMap = {};
            headers.forEach((h, i) => headerMap[h.toLowerCase().replace(/\s+/g, '')] = i); // Create a map for easier access

            let testsProcessed = 0;
            let pricesProcessed = 0;

            const dataRows = jsonData.slice(1);
            // Group by Test Name first to create/update test doc once
            const testsToProcess = {};
            dataRows.forEach(row => {
                const testNameValue = row[headerMap['testname']];
                const testName = testNameValue ? String(testNameValue).trim() : null;
                if (!testName) return; // Skip rows with no test name

                if (!testsToProcess[testName]) {
                    testsToProcess[testName] = {
                        description: row[headerMap['description']] ? String(row[headerMap['description']]).trim() : null,
                        imageUrl: row[headerMap['imageurl']] ? String(row[headerMap['imageurl']]).trim() : null,
                        tags: row[headerMap['tags']] ? String(row[headerMap['tags']]).split(',').map(t => t.trim()).filter(t => t) : [],
                        isPopular: String(row[headerMap['ispopular']]).toUpperCase() === 'TRUE',
                        isPackage: String(row[headerMap['ispackage']]).toUpperCase() === 'TRUE',
                        isActive: String(row[headerMap['isactive']]).toUpperCase() === 'FALSE' ? false : true, // Default true
                        bannerText: row[headerMap['bannertext']] ? String(row[headerMap['bannertext']]).trim() : null,
                        healthConcernSlugs: row[headerMap['healthconcernslugs']] ? String(row[headerMap['healthconcernslugs']]).split(',').map(t => t.trim()).filter(t => t) : [],
                        labPrices: []
                    };
                }
                const labNameValue = row[headerMap['labname']];
                const labName = labNameValue ? String(labNameValue).trim() : null;
                const priceValue = row[headerMap['price']];
                const price = priceValue !== undefined && !isNaN(parseFloat(priceValue)) ? parseFloat(priceValue) : null;
                const originalPriceValue = row[headerMap['originalprice']];
                const originalPrice = originalPriceValue !== undefined && !isNaN(parseFloat(originalPriceValue)) ? parseFloat(originalPriceValue) : null;

                if (labName && price !== null) {
                    testsToProcess[testName].labPrices.push({ labName, price, originalPrice });
                }
            });


            for (const testName in testsToProcess) {
                const testDetails = testsToProcess[testName];
                let testId;

                // Check if test exists
                const testQuerySnapshot = await firestoreRequest('getDocs', 'tests', null, null, [{ type: 'where', field: 'testName', op: '==', value: testName }]);
                if (!testQuerySnapshot.empty) {
                    testId = testQuerySnapshot.docs[0].id;
                    // Update existing test
                    await firestoreRequest('updateDoc', 'tests', testId, {
                        description: testDetails.description,
                        imageUrl: testDetails.imageUrl,
                        tags: testDetails.tags,
                        isPopular: testDetails.isPopular,
                        isPackage: testDetails.isPackage,
                        isActive: testDetails.isActive,
                        bannerText: testDetails.bannerText,
                        healthConcernSlugs: testDetails.healthConcernSlugs
                    });
                } else {
                    // Add new test
                    const newTestRef = await firestoreRequest('addDoc', 'tests', null, {
                        testName: testName,
                        description: testDetails.description,
                        imageUrl: testDetails.imageUrl,
                        tags: testDetails.tags,
                        isPopular: testDetails.isPopular,
                        isPackage: testDetails.isPackage,
                        isActive: testDetails.isActive,
                        bannerText: testDetails.bannerText,
                        healthConcernSlugs: testDetails.healthConcernSlugs
                    });
                    testId = newTestRef.id;
                }
                testsProcessed++;

                // Process lab prices for this test
                for (const priceDetail of testDetails.labPrices) {
                    const lab = labsListCache.find(l => l.name.toLowerCase() === priceDetail.labName.toLowerCase());
                    if (!lab) {
                        console.warn(`Lab named "${priceDetail.labName}" not found in cache. Skipping price for test "${testName}".`);
                        continue;
                    }

                    const priceData = {
                        testId: testId,
                        testName: testName, // Denormalized
                        labId: lab.id,
                        labName: lab.name, // Denormalized
                        price: priceDetail.price,
                        originalPrice: priceDetail.originalPrice !== undefined ? priceDetail.originalPrice : null
                    };

                    // Check if this price entry already exists
                    const existingPriceQuery = await firestoreRequest('getDocs', 'testLabPrices', null, null, [
                        { type: 'where', field: 'testId', op: '==', value: testId },
                        { type: 'where', field: 'labId', op: '==', value: lab.id }
                    ]);

                    if (!existingPriceQuery.empty) {
                        const existingPriceDocId = existingPriceQuery.docs[0].id;
                        await firestoreRequest('updateDoc', 'testLabPrices', existingPriceDocId, priceData);
                    } else {
                        await firestoreRequest('addDoc', 'testLabPrices', null, priceData);
                    }
                    pricesProcessed++;
                }
            }
            showToast(`${testsProcessed} tests and ${pricesProcessed} price entries processed from Excel.`, "success", 7000);
            loadTests(); // Refresh the tests table
            document.getElementById('dashboard-import-excel-file').value = ''; // Clear file input

        } catch (err) {
            console.error("Error processing Excel file:", err);
            showToast("Error processing Excel file: " + err.message, "error", 7000);
            document.getElementById('dashboard-import-excel-file').value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}


async function importQuickSelectTests() {
    const quickTestNames = [
        "CBC", "THYROID PROFILE", "MAGNESIUM", "VITAMIN D", "VITAMIN B12", "HBA1C", 
        "KFT", "LFT", "LIPID PROFILE", "URINE R/M", "BLOOD SUGAR FASTING", 
        "BLOOD SUGAR PP", "IRON STUDIES", "CALCIUM", "AMYLASE", "LIPASE",
        "GGT", "PROLACTIN", "LH", "FSH", "TESTOSTERONE", "ESTRADIOL (E2)",
        "C REACTIVE PROTEIN (CRP)", "ESR", "D DIMER", "HEMOGLOBIN (HB)",
        "PLATELET COUNT", "ANTI CCP", "RA FACTOR", "HIV 1 & 2 ANTIBODIES"
    ];

    let importedCount = 0;
    let skippedCount = 0;
    showToast(`Importing ${quickTestNames.length} default tests...`, "info", 5000);

    try {
        for (const testName of quickTestNames) {
            const querySnapshot = await firestoreRequest('getDocs', 'tests', null, null, 
                [{ type: 'where', field: 'testName', op: '==', value: testName }]
            );
            if (querySnapshot.empty) {
                await firestoreRequest('addDoc', 'tests', null, {
                    testName: testName,
                    description: `${testName} test. Details to be updated by admin.`,
                    imageUrl: null,
                    tags: [testName.toLowerCase().replace(/\s+/g, '')],
                    isPopular: false,
                    isPackage: false,
                    isActive: true,
                    bannerText: null,
                    healthConcernSlugs: []
                });
                importedCount++;
            } else {
                skippedCount++;
            }
        }
        showToast(`${importedCount} new tests imported. ${skippedCount} tests already existed.`, "success", 7000);
        loadTests();
    } catch (error) {
        console.error("Error importing quick select tests:", error);
        showToast("Failed to import default tests. " + error.message, "error");
    }
}


// ----- Main App Logic Initialization -----
// (To be filled after all helper, data loading, and form handler functions are defined)


// ----- DOMContentLoaded Event Listener -----
// (To be filled after all functions are defined)
// Global DOM Element Variables
let loaderContainer, loginContainer, dashboardContainer, criticalErrorBanner;
let adminUserEmailElement, logoutButton, toastNotificationElement;

let addLabForm, editLabFormModal;
let addTestForm, editTestFormModal;
let addHealthConcernForm, editHealthConcernModal;
let addOfferForm, editOfferFormModal;
let addPrimaryBannerForm, addSecondaryBannerForm, editBannerModal;
let siteSettingsForm, themeSettingsForm;
let updatePrescriptionStatusFormModal, userBookingsModal;
let dashboardExportExcelBtn, dashboardImportExcelFile, dashboardImportExcelSubmitBtn;
let importDefaultQuickTestsBtn; // For importing common tests

function checkEssentialElements() {
    loaderContainer = document.getElementById('loader-container');
    loginContainer = document.getElementById('login-container');
    dashboardContainer = document.getElementById('dashboard-container');
    criticalErrorBanner = document.getElementById('critical-error-banner');
    adminUserEmailElement = document.getElementById('admin-user-email');
    logoutButton = document.getElementById('logout-button');
    toastNotificationElement = document.getElementById('toast-notification');

    const missing = [];
    if (!loaderContainer) missing.push('loader-container');
    if (!loginContainer) missing.push('login-container');
    if (!dashboardContainer) missing.push('dashboard-container');
    if (!criticalErrorBanner) missing.push('critical-error-banner');
    if (!adminUserEmailElement) missing.push('admin-user-email');
    if (!logoutButton) missing.push('logout-button');
    if (!toastNotificationElement) missing.push('toast-notification');

    if (missing.length > 0) {
        const errorMsg = `CRITICAL ERROR: Essential HTML page containers not found: ${missing.join(', ')}. Admin panel cannot load. Check index.html.`;
        console.error(errorMsg);
        if (criticalErrorBanner) {
            criticalErrorBanner.textContent = errorMsg;
            criticalErrorBanner.style.display = 'block';
        } else {
            // Fallback if even the banner is missing
            document.body.innerHTML = `<div style="color:red; padding:20px; font-size:18px;">${errorMsg}</div>` + document.body.innerHTML;
        }
        if(loaderContainer) loaderContainer.style.display = 'none'; // Hide loader if stuck
        return false;
    }
    return true;
}


let tabButtons = [];
let tabContents = [];

function initializeDashboardTabsAndContent() {
    const tabsNavContainer = document.getElementById('sidebar-tabs-nav');
    if (!tabsNavContainer) {
        console.warn("Tabs container (sidebar navigation) not found! Cannot initialize tabs.");
        return false;
    }
    tabButtons = tabsNavContainer.querySelectorAll('.tab-button');
    tabContents = document.querySelectorAll('.main-content .tab-content'); // Ensure specificity

    if (tabButtons.length === 0 || tabContents.length === 0) {
        console.warn("Tab buttons or tab content areas not found. Tab functionality will be limited.");
        return false;
    }
    
    console.log(`Found ${tabButtons.length} tab buttons and ${tabContents.length} tab contents.`);

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log(`Tab button clicked for: ${button.dataset.tab}`);
            switchTab(button.dataset.tab);
        });
    });
    return true; // Initialization successful
}


function switchTab(tabId) {
    console.log(`switchTab called for: ${tabId}`);
    if (tabButtons.length === 0 || tabContents.length === 0) {
        console.warn("Tab elements not initialized, cannot switch tab.");
        const banner = document.getElementById('critical-error-banner');
        if (banner) {
            banner.textContent = "Error: Tab navigation is broken. Please refresh or check console.";
            banner.style.display = 'block';
        }
        return;
    }

    tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
            content.classList.add('active');
            console.log(`Tab content ${content.id} activated.`);
        }
    });
    tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.dataset.tab === tabId) {
            button.classList.add('active');
            console.log(`Tab button for ${button.dataset.tab} activated.`);
        }
    });

    // Load data for the activated tab
    if (tabId === 'manage-labs-tab') loadLabs();
    else if (tabId === 'manage-tests-tab') {
        loadTests();
        setupImageUpload('test-image-file-input', 'test-image-url-input', 'test-image-preview-img', 'test-image-upload-btn');
        populateHealthConcernsCheckboxes('health-concerns-checkboxes-add');
        const addLabPriceBtnAdd = document.getElementById('add-lab-price-row-btn-add');
        if (addLabPriceBtnAdd && !addLabPriceBtnAdd._listenerAttached) {
             addLabPriceBtnAdd.addEventListener('click', () => addLabPriceRow(document.getElementById('lab-prices-container-add'), null, false));
             addLabPriceBtnAdd._listenerAttached = true;
        }
    }
    else if (tabId === 'manage-health-concerns-tab') {
        loadHealthConcernsForAdmin();
        setupImageUpload('hc-icon-file-input', 'hc-icon-url-input', 'hc-icon-preview-img', 'hc-icon-upload-btn');
    }
    else if (tabId === 'manage-offers-tab') {
        loadOffers();
        loadTestsForOfferForm('offer-test-id-input'); // For Add Offer form
    }
    else if (tabId === 'view-prescriptions-tab') loadPrescriptions();
    else if (tabId === 'manage-users-tab') loadUsers();
    else if (tabId === 'manage-bookings-tab') loadAllBookings();
    else if (tabId === 'manage-banners-tab') {
        loadBanners('primary');
        loadBanners('secondary');
        setupImageUpload('primary-banner-image-file-input', 'primary-banner-image-url-input', 'primary-banner-image-preview-img', 'primary-banner-image-upload-btn');
        setupImageUpload('secondary-banner-image-file-input', 'secondary-banner-image-url-input', 'secondary-banner-image-preview-img', 'secondary-banner-image-upload-btn');
    }
    else if (tabId === 'site-settings-tab') {
        loadSiteSettings();
        setupImageUpload('site-logo-file-input', 'site-logo-url-input', 'site-logo-preview-img', 'site-logo-upload-btn');
    }
    // Manage Data and Charts tabs don't load data on switch by default
}

function showDashboardUI(user) {
    console.log("showDashboardUI called for user:", user.email);
    if (loaderContainer) loaderContainer.classList.remove('active');
    if (loginContainer) loginContainer.style.display = 'none';
    if (dashboardContainer) dashboardContainer.style.display = 'flex'; // Use flex for sidebar layout
    
    if (adminUserEmailElement) adminUserEmailElement.textContent = user.email;

    if (!initializeDashboardTabsAndContent()) {
        console.error("Failed to initialize dashboard tabs. UI may be incomplete.");
        // showLoader(false) will still be called to hide loader.
    }
    
    // Load initial data for the default active tab (Manage Labs)
    // Also pre-load labs for dropdowns if not already cached
    loadLabs().then(() => { // Ensure labs are loaded for dropdowns
        console.log("Labs loaded, now switching to default tab.");
        const initialActiveTab = document.querySelector('.tab-button.active')?.dataset.tab || 'manage-labs-tab';
        switchTab(initialActiveTab); 
    }).catch(error => {
        console.error("Error loading initial labs for dashboard:", error);
        showToast("Could not load initial lab data.", "error");
        const initialActiveTab = document.querySelector('.tab-button.active')?.dataset.tab || 'manage-labs-tab';
        switchTab(initialActiveTab); // Still try to switch tab
    });
    
    // Pre-load health concerns for checkboxes
    loadHealthConcernsForAdmin().then(() => {
        console.log("Health concerns pre-loaded for admin forms.");
    }).catch(error => {
        console.error("Error pre-loading health concerns:", error);
    });

    // Pre-load tests for offer form dropdowns
    loadTestsForOfferForm('offer-test-id-input'); // Prime the add offer form's select
    // Also prime the edit offer form's select if it exists (it might not be in DOM yet)
    const editOfferTestSelect = document.getElementById('edit-offer-test-id-modal-input');
    if (editOfferTestSelect) {
        loadTestsForOfferForm('edit-offer-test-id-modal-input');
    }

    showLoader(false); // Ensure loader is hidden
}

function showLoginScreen() {
    console.log("showLoginScreen called.");
    if (loaderContainer) loaderContainer.classList.remove('active');
    if (dashboardContainer) dashboardContainer.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'flex';
    showLoader(false); // Ensure loader is hidden
}


async function initializeAppMainLogic() {
    console.log("Attempting to initialize app logic...");
    showLoader(true);

    if (!checkEssentialElements()) {
        // checkEssentialElements already shows a critical error banner and hides loader
        return;
    }
    
    console.log("Essential HTML elements found.");
    console.log("Imported Firebase services:", { authInstance, dbInstance, firebaseAuthFunctions, firebaseFirestoreFunctions, firebaseStorageFunctions });

    if (!authInstance || !dbInstance || !firebaseAuthFunctions || !firebaseFirestoreFunctions ) {
        const errorMsg = "CRITICAL ERROR: Imported Firebase services (authInstance, dbInstance, or function groups) are not defined. Check firebase-config.js imports/exports.";
        console.error(errorMsg);
        if (criticalErrorBanner) {
            criticalErrorBanner.textContent = errorMsg;
            criticalErrorBanner.style.display = 'block';
        }
        showLoader(false);
        return;
    }
     console.log("Firebase services successfully imported and checked in app.js.");


    // Setup general event listeners that are always present
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                if (authInstance && firebaseAuthFunctions && firebaseAuthFunctions.signOut) {
                    await firebaseAuthFunctions.signOut(authInstance);
                    console.log("User logged out.");
                    // onAuthStateChanged will handle UI update to login screen
                } else {
                    console.error("Auth service or signOut function not available for logout.");
                    showToast("Logout failed: Auth service unavailable.", "error");
                }
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Logout failed: ' + error.message, 'error');
            }
        });
    } else {
        console.warn("Logout button not found.");
    }
    
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });
    
    // Modal closing on escape key
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                if (modal.style.display === 'flex') {
                    closeModal(modal.id);
                }
            });
        }
    });


    // Setup static form listeners
    addLabForm = document.getElementById('add-lab-form');
    if (addLabForm) addLabForm.addEventListener('submit', handleAddLabFormSubmit);
    else console.warn("Add Lab form not found.");

    addTestForm = document.getElementById('add-test-form');
    if (addTestForm) addTestForm.addEventListener('submit', handleAddTestFormSubmit);
    else console.warn("Add Test form (add-test-form) not found.");

    addHealthConcernForm = document.getElementById('add-health-concern-form');
    if (addHealthConcernForm) addHealthConcernForm.addEventListener('submit', handleAddHealthConcernFormSubmit);
    else console.warn("Add Health Concern form (add-health-concern-form) not found.");

    addOfferForm = document.getElementById('add-offer-form');
    if (addOfferForm) addOfferForm.addEventListener('submit', handleAddOfferFormSubmit);
    else console.warn("Add Offer form (add-offer-form) not found.");

    addPrimaryBannerForm = document.getElementById('add-primary-banner-form');
    if (addPrimaryBannerForm) addPrimaryBannerForm.addEventListener('submit', (e) => handleAddBannerFormSubmit(e, 'primary'));
    else console.warn("Add Primary Banner form not found.");
    
    addSecondaryBannerForm = document.getElementById('add-secondary-banner-form');
    if (addSecondaryBannerForm) addSecondaryBannerForm.addEventListener('submit', (e) => handleAddBannerFormSubmit(e, 'secondary'));
    else console.warn("Add Secondary Banner form not found.");

    siteSettingsForm = document.getElementById('site-settings-form');
    if (siteSettingsForm) siteSettingsForm.addEventListener('submit', handleSiteSettingsFormSubmit);
    else console.warn("Site Settings form not found.");

    themeSettingsForm = document.getElementById('theme-settings-form');
    if (themeSettingsForm) themeSettingsForm.addEventListener('submit', handleThemeSettingsFormSubmit);
    else console.warn("Theme Settings form not found.");

    // Listeners for edit forms are attached when modals are opened (see openEdit...Modal functions)
    // Setup for Excel import/export button
    dashboardExportExcelBtn = document.getElementById('dashboard-export-excel-btn');
    if (dashboardExportExcelBtn) {
        dashboardExportExcelBtn.addEventListener('click', exportTestsToExcel);
    } else {
        console.warn("Export to Excel button (dashboard-export-excel-btn) not found.");
    }

    dashboardImportExcelFile = document.getElementById('dashboard-import-excel-file');
    dashboardImportExcelSubmitBtn = document.getElementById('dashboard-import-excel-submit-btn');
    if (dashboardImportExcelSubmitBtn && dashboardImportExcelFile) {
        dashboardImportExcelSubmitBtn.addEventListener('click', () => {
            if (dashboardImportExcelFile.files.length > 0) {
                handleExcelImport(dashboardImportExcelFile.files[0]);
            } else {
                showToast("Please select an Excel file to import.", "info");
            }
        });
    } else {
        console.warn("Excel import file input or submit button not found.");
    }
    
    importDefaultQuickTestsBtn = document.getElementById('import-quick-tests-btn');
    if (importDefaultQuickTestsBtn) {
        importDefaultQuickTestsBtn.addEventListener('click', importQuickSelectTests);
    } else {
        console.warn("Import Default Quick Tests button (import-quick-tests-btn) not found.");
    }


    // Setup event delegation for tables (Edit/Delete/View Bookings/Update Status buttons)
    const mainContentArea = document.querySelector('.main-content');
    if (mainContentArea) {
        mainContentArea.addEventListener('click', async (event) => {
            const targetButton = event.target.closest('button');
            if (!targetButton) return;

            const id = targetButton.dataset.id;
            const type = targetButton.dataset.type;
            
            if (targetButton.classList.contains('edit-btn') && id && type) {
                console.log(`Edit button clicked for type: ${type}, ID: ${id}`);
                try {
                    const collectionName =
                        type === 'banner'
                            ? (targetButton.dataset.bannerType === 'primary' ? 'promotionalBanners' : 'secondaryPromotionalBanners')
                            : type === 'healthConcern'
                                ? 'healthConcerns'
                                : type === 'prescriptionStatus'
                                    ? 'prescriptions'
                                    : `${type}s`;
                    const docSnap = await firestoreRequest('getDoc', collectionName, id);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (type === 'lab') openEditLabModal(data, id);
                        else if (type === 'test') openEditTestModal(data, id);
                        else if (type === 'healthConcern') openEditHealthConcernModal(data, id);
                        else if (type === 'offer') openEditOfferModal(data, id);
                        else if (type === 'prescriptionStatus') openUpdatePrescriptionStatusModal(data, id);
                        else if (type === 'banner') openEditBannerModal(data, id, targetButton.dataset.bannerType);
                    } else {
                        showToast(`${type} not found for editing.`, "error");
                    }
                } catch (error) {
                    showToast(`Error fetching ${type} for editing. ` + error.message, "error");
                }
            } else if (targetButton.classList.contains('delete-btn') && id && type) {
                console.log(`Delete button clicked for type: ${type}, ID: ${id}`);
                deleteItem(id, type, targetButton.dataset.bannerType || null);
            } else if (targetButton.classList.contains('view-bookings-btn') && id) {
                console.log(`View bookings button clicked for user ID: ${id}`);
                openUserBookingsModal(id, targetButton.dataset.username || 'User');
            } else if (targetButton.classList.contains('update-booking-status-btn') && id) {
                const selectElement = targetButton.previousElementSibling; // Assumes select is immediately before button
                if (selectElement && selectElement.tagName === 'SELECT') {
                    const newStatus = selectElement.value;
                    console.log(`Update booking status button clicked for ID: ${id}, New Status: ${newStatus}`);
                    try {
                        await firestoreRequest('updateDoc', 'bookings', id, { status: newStatus });
                        showToast(`Booking ${id} status updated to ${newStatus}.`, 'success');
                        loadAllBookings(); // Refresh the list
                    } catch (error) {
                        showToast(`Failed to update booking status. ${error.message}`, 'error');
                    }
                } else {
                    console.warn("Could not find status select for booking ID:", id);
                }
            }
        });
    } else {
        console.warn("Main content area not found for event delegation.");
    }


    // Firebase Auth State Listener
    console.log("Attempting to set up onAuthStateChanged listener...");
    try {
        if (!firebaseAuthFunctions || !firebaseAuthFunctions.onAuthStateChanged) {
             console.error("CRITICAL: firebaseAuthFunctions.onAuthStateChanged is not available!");
             showToast("Authentication service error. Please refresh.", "error", 10000);
             showLoginScreen(); // Show login, but it might not work
             showLoader(false);
             return;
        }
        firebaseAuthFunctions.onAuthStateChanged(authInstance, (user) => {
            console.log("onAuthStateChanged listener fired.");
            if (user) {
                console.log("User is signed in:", user.uid, user.email);
                // Removed allowedAdminUIDs check: allow any authenticated user
                showDashboardUI(user);
            } else {
                console.log("No user signed in.");
                showLoginScreen(); // This will also call showLoader(false)
            }
        }, (error) => {
            console.error("Error in onAuthStateChanged listener itself:", error);
            showToast("Authentication state error: " + error.message, "error", 5000);
            showLoginScreen();
            showLoader(false);
        });
        console.log("onAuthStateChanged listener successfully attached.");
    } catch (error) {
        console.error("CRITICAL Error setting up onAuthStateChanged listener:", error);
        showToast("Critical authentication setup error. Please refresh. " + error.message, "error", 10000);
        showLoginScreen(); // Attempt to show login screen
        showLoader(false); // Ensure loader is hidden
    }
}

// ----- Main Initialization Logic -----
if (firebaseConfigLoaded && authInstance && dbInstance && firebaseAuthFunctions && firebaseFirestoreFunctions) {
    console.log("app.js: Firebase services successfully imported from firebase-config.js.");
    // Defer main app logic until DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAppMainLogic);
    } else {
        initializeAppMainLogic(); // DOM is already ready
    }
} else {
    const errorMsg = "CRITICAL ERROR: Core Firebase services or configLoaded flag not imported correctly from firebase-config.js. Admin panel cannot initialize.";
    console.error(errorMsg);
    // Attempt to show error on page even if loader is stuck
    const criticalBanner = document.getElementById('critical-error-banner');
    if (criticalBanner) {
        criticalBanner.textContent = errorMsg;
        criticalBanner.style.display = 'block';
    } else {
         // Fallback if even the banner is missing (should not happen if index.html is correct)
        document.body.innerHTML = `<div style="color:red; background:black; padding:20px; font-size:18px; position:fixed; top:0; left:0; width:100%; z-index:9999;">${errorMsg}</div>` + document.body.innerHTML;
    }
    const loader = document.getElementById('loader-container');
    if (loader) loader.style.display = 'none';
}

console.log("app.js: Module execution finished.");

// --- Admin Login Handler ---
if (document.getElementById('admin-login-form')) {
    document.getElementById('admin-login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('admin-email').value.trim();
        const password = document.getElementById('admin-password').value.trim();
        if (!email || !password) {
            showToast("Please enter both email and password.", "error");
            return;
        }
        try {
            if (!authInstance || !firebaseAuthFunctions || !firebaseAuthFunctions.signInWithEmailAndPassword) {
                showToast("Authentication service not available.", "error");
                return;
            }
            await firebaseAuthFunctions.signInWithEmailAndPassword(authInstance, email, password);
            showToast("Login successful! Redirecting...", "success");
            // onAuthStateChanged will handle UI update
        } catch (error) {
            let msg = "Login failed. Please check your credentials.";
            if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
                msg = "Invalid email or password.";
            } else if (error.code === "auth/too-many-requests") {
                msg = "Too many failed attempts. Please try again later.";
            }
            showToast(msg, "error");
        }
    });
}

// --- Auto-allow current admin UID ---
if (authInstance && firebaseAuthFunctions && firebaseAuthFunctions.onAuthStateChanged) {
    firebaseAuthFunctions.onAuthStateChanged(authInstance, (user) => {
        if (user && !allowedAdminUIDs.includes(user.uid)) {
            allowedAdminUIDs.push(user.uid);
            console.log('Added current user UID to allowedAdminUIDs:', user.uid);
        }
    });
}

// Add this after DOMContentLoaded or after switchTab('manage-tests-tab')
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('test-search-input');
    if (searchInput && !searchInput._listenerAttached) {
        searchInput.addEventListener('input', function() {
            loadTests();
        });
        searchInput._listenerAttached = true;
    }
});
// Also add in switchTab for manage-tests-tab
const origSwitchTab = switchTab;
switchTab = function(tabId) {
    origSwitchTab(tabId);
    if (tabId === 'manage-tests-tab') {
        const searchInput = document.getElementById('test-search-input');
        if (searchInput && !searchInput._listenerAttached) {
            searchInput.addEventListener('input', function() {
                loadTests();
            });
            searchInput._listenerAttached = true;
        }
    }
};

// --- Real-time Booking Notification Sound ---
let bookingSoundAudio = null;
let stopSoundBtn = null;
let lastBookingIds = new Set();
let soundShouldLoop = false;
let alarmLoopTimeout = null;
let alarmSoundIndex = 0;
const alarmSounds = [
  'https://soundbible.com/mp3/alarm_clock.mp3',
  'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'
];

function isSoundEnabled() {
  return localStorage.getItem('soundEnabledByUser') === 'true';
}

function setSoundEnabled(val) {
  localStorage.setItem('soundEnabledByUser', val ? 'true' : 'false');
  soundEnabledByUser = val;
}

function showEnableSoundBanner() {
  if (isSoundEnabled()) return;
  if (document.getElementById('enable-sound-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'enable-sound-banner';
  banner.style.position = 'fixed';
  banner.style.top = '0';
  banner.style.left = '0';
  banner.style.width = '100%';
  banner.style.background = '#2563eb';
  banner.style.color = '#fff';
  banner.style.fontSize = '1.1rem';
  banner.style.fontWeight = 'bold';
  banner.style.padding = '16px';
  banner.style.textAlign = 'center';
  banner.style.zIndex = '99999';
  banner.innerHTML = '🔊 Click here to enable sound notifications for new bookings!';
  banner.style.cursor = 'pointer';
  banner.onclick = function() {
    const testAudio = new Audio(alarmSounds[0]);
    testAudio.volume = 1.0;
    testAudio.play().then(() => {
      setSoundEnabled(true);
      banner.remove();
      showToast('Sound notifications enabled!', 'success', 3000);
    }).catch(() => {
      showToast('Please interact with the page to enable sound.', 'info', 3000);
    });
  };
  document.body.appendChild(banner);
}

function playWebAudioBeepLoop() {
  if (!isSoundEnabled()) {
    showEnableSoundBanner();
    showToast('🔔 New booking! (Sound blocked by browser, please enable sound at top)', 'info', 5000);
    return;
  }
  stopBookingSound();
  soundShouldLoop = true;
  function beep() {
    if (!soundShouldLoop) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.2;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
      if (soundShouldLoop) {
        alarmLoopTimeout = setTimeout(beep, 500); // 0.5s gap between beeps
      }
    }, 1000); // 1 second beep
    window._currentAlarmAudio = { _stopRef: () => { o.stop(); ctx.close(); } };
  }
  beep();
  showStopSoundButton();
}

function showStopSoundButton() {
  if (stopSoundBtn) return;
  stopSoundBtn = document.createElement('button');
  stopSoundBtn.textContent = '🔊 Stop Sound';
  stopSoundBtn.style.position = 'fixed';
  stopSoundBtn.style.bottom = '24px';
  stopSoundBtn.style.right = '24px';
  stopSoundBtn.style.zIndex = '9999';
  stopSoundBtn.style.background = '#e11d48';
  stopSoundBtn.style.color = '#fff';
  stopSoundBtn.style.fontSize = '1.2rem';
  stopSoundBtn.style.fontWeight = 'bold';
  stopSoundBtn.style.padding = '14px 22px';
  stopSoundBtn.style.border = 'none';
  stopSoundBtn.style.borderRadius = '32px';
  stopSoundBtn.style.boxShadow = '0 2px 16px rgba(0,0,0,0.18)';
  stopSoundBtn.style.cursor = 'pointer';
  stopSoundBtn.onclick = stopBookingSound;
  document.body.appendChild(stopSoundBtn);
}

function hideStopSoundButton() {
  if (stopSoundBtn) {
    stopSoundBtn.remove();
    stopSoundBtn = null;
  }
}

async function setupBookingNotificationListener() {
  // Try v9 modular first
  if (firebaseFirestoreFunctions && firebaseFirestoreFunctions.onSnapshot) {
    try {
      const { collection, query, orderBy, limit, onSnapshot } = firebaseFirestoreFunctions;
      const bookingsRef = collection(dbInstance, 'bookings');
      const bookingsQuery = query(bookingsRef, orderBy('bookingDate', 'desc'), limit(10));
      onSnapshot(bookingsQuery, (snapshot) => {
        window.latestBookingSnapshot = snapshot;
        updateBookingsTableFromSnapshot(snapshot);
      });
      return;
    } catch (e) {
      // fallback to v8
    }
  }
  // Fallback to v8
  if (dbInstance && dbInstance.collection) {
    const bookingsRef = dbInstance.collection('bookings').orderBy('bookingDate', 'desc').limit(10);
    bookingsRef.onSnapshot(snapshot => {
      window.latestBookingSnapshot = snapshot;
      updateBookingsTableFromSnapshot(snapshot);
    });
  }
}

function updateBookingsTableFromSnapshot(snapshot) {
  let newBookingDetected = false;
  // Only update table if bookings tab is visible
  const bookingsTab = document.getElementById('manage-bookings-tab');
  const bookingsTableBody = document.getElementById('bookings-table-body');
  if (bookingsTab && bookingsTab.classList.contains('active') && bookingsTableBody) {
    bookingsTableBody.innerHTML = '';
    if (snapshot.empty || (snapshot.docs && snapshot.docs.length === 0)) {
      bookingsTableBody.innerHTML = '<tr><td colspan="8">No bookings found.</td></tr>';
    } else {
      (snapshot.docs || snapshot).forEach(docSnap => {
        const doc = docSnap.data ? docSnap : { data: () => docSnap.data, id: docSnap.id };
        const bookingData = doc.data();
        const bookingId = doc.id;
        const row = bookingsTableBody.insertRow();
        row.insertCell().textContent = bookingId;
        row.insertCell().textContent = bookingData.userName || 'N/A';
        row.insertCell().textContent = `${bookingData.userEmail || 'N/A'} / ${bookingData.userPhone || 'N/A'}`;
        row.insertCell().textContent = bookingData.bookingDate ? (bookingData.bookingDate.toDate ? bookingData.bookingDate.toDate().toLocaleString() : new Date(bookingData.bookingDate).toLocaleString()) : 'N/A';
        row.insertCell().textContent = `₹${bookingData.totalAmount !== undefined ? bookingData.totalAmount.toFixed(2) : '0.00'}`;
        let itemsHtml = '<ul>';
        if (bookingData.items && bookingData.items.length > 0) {
          bookingData.items.forEach(item => {
            itemsHtml += `<li>${item.testName} (${item.labName}) - ₹${item.price.toFixed(2)}</li>`;
          });
        } else {
          itemsHtml += '<li>No items</li>';
        }
        itemsHtml += '</ul>';
        row.insertCell().innerHTML = itemsHtml;
        const statusCell = row.insertCell();
        statusCell.textContent = bookingData.status || 'N/A';
        const actionsCell = row.insertCell();
        const statusSelect = document.createElement('select');
        statusSelect.classList.add('status-select');
        const statuses = ["Pending Confirmation", "Confirmed", "Processing", "Sample Collected", "Report Generated", "Completed", "Cancelled", "Refunded"];
        statuses.forEach(status => {
          const option = document.createElement('option');
          option.value = status;
          option.textContent = status;
          if (status === bookingData.status) {
            option.selected = true;
          }
          statusSelect.appendChild(option);
        });
        actionsCell.appendChild(statusSelect);
        const updateButton = document.createElement('button');
        updateButton.classList.add('btn', 'btn-secondary', 'btn-sm', 'update-booking-status-btn');
        updateButton.innerHTML = '<i class="fas fa-save"></i> Update';
        updateButton.dataset.id = bookingId;
        actionsCell.appendChild(updateButton);
      });
    }
  }
  // Detect new bookings for notification
  (snapshot.docChanges ? snapshot.docChanges() : []).forEach(change => {
    if (change.type === 'added') {
      const bookingId = change.doc.id;
      console.log('[BookingListener] New booking detected:', bookingId);
      if (!lastBookingIds.has(bookingId)) {
        newBookingDetected = true;
        lastBookingIds.add(bookingId);
      }
    }
  });
  if (lastBookingIds.size > 20) {
    lastBookingIds = new Set(Array.from(lastBookingIds).slice(-20));
  }
  if (newBookingDetected) {
    console.log('[BookingListener] Playing sound for new booking!');
    playWebAudioBeepLoop();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupBookingNotificationListener();
});

let soundEnabledByUser = false;

document.addEventListener('DOMContentLoaded', function() {
  soundEnabledByUser = isSoundEnabled();
  showEnableSoundBanner();
  // Add Test Alarm button for admin
  if (!document.getElementById('test-alarm-btn')) {
    const btn = document.createElement('button');
    btn.id = 'test-alarm-btn';
    btn.textContent = '🔊 Test Alarm';
    btn.style.position = 'fixed';
    btn.style.bottom = '24px';
    btn.style.left = '24px';
    btn.style.zIndex = '9999';
    btn.style.background = '#2563eb';
    btn.style.color = '#fff';
    btn.style.fontSize = '1.1rem';
    btn.style.fontWeight = 'bold';
    btn.style.padding = '12px 20px';
    btn.style.border = 'none';
    btn.style.borderRadius = '32px';
    btn.style.boxShadow = '0 2px 16px rgba(0,0,0,0.18)';
    btn.style.cursor = 'pointer';
    btn.onclick = triggerBookingAlert;
    document.body.appendChild(btn);
  }
});

let alarmAudioCtx = null;
let alarmOscillator = null;
let alarmGain = null;
let alarmActive = false;

function startPersistentAlarm() {
  if (!isSoundEnabled()) {
    showEnableSoundBanner();
    showToast('🔔 New booking! (Sound blocked by browser, please enable sound at top)', 'info', 5000);
    return;
  }
  stopPersistentAlarm();
  alarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  alarmOscillator = alarmAudioCtx.createOscillator();
  alarmGain = alarmAudioCtx.createGain();
  alarmOscillator.type = 'square';
  alarmOscillator.frequency.value = 880;
  alarmGain.gain.value = 0.2;
  alarmOscillator.connect(alarmGain);
  alarmGain.connect(alarmAudioCtx.destination);
  alarmOscillator.start();
  alarmActive = true;
  showStopSoundButton();
}

function stopPersistentAlarm() {
  alarmActive = false;
  if (alarmOscillator) {
    alarmOscillator.stop();
    alarmOscillator.disconnect();
    alarmOscillator = null;
  }
  if (alarmGain) {
    alarmGain.disconnect();
    alarmGain = null;
  }
  if (alarmAudioCtx) {
    alarmAudioCtx.close();
    alarmAudioCtx = null;
  }
  hideStopSoundButton();
}

// Replace playBookingSound and Test Alarm button to use persistent alarm
function playBookingSound() {
  startPersistentAlarm();
}

// Replace Stop Sound logic
function stopBookingSound() {
  stopPersistentAlarm();
}

document.addEventListener('DOMContentLoaded', function() {
  soundEnabledByUser = isSoundEnabled();
  showEnableSoundBanner();
  // Add Test Alarm button for admin
  if (!document.getElementById('test-alarm-btn')) {
    const btn = document.createElement('button');
    btn.id = 'test-alarm-btn';
    btn.textContent = '🔊 Test Alarm';
    btn.style.position = 'fixed';
    btn.style.bottom = '24px';
    btn.style.left = '24px';
    btn.style.zIndex = '9999';
    btn.style.background = '#2563eb';
    btn.style.color = '#fff';
    btn.style.fontSize = '1.1rem';
    btn.style.fontWeight = 'bold';
    btn.style.padding = '12px 20px';
    btn.style.border = 'none';
    btn.style.borderRadius = '32px';
    btn.style.boxShadow = '0 2px 16px rgba(0,0,0,0.18)';
    btn.style.cursor = 'pointer';
    btn.onclick = triggerBookingAlert;
    document.body.appendChild(btn);
  }
});

// --- Visual Modal/Overlay for New Booking Alert ---
function showBookingAlertModal() {
  if (document.getElementById('booking-alert-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'booking-alert-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.7)';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '100000';
  const box = document.createElement('div');
  box.style.background = '#fff';
  box.style.padding = '48px 32px';
  box.style.borderRadius = '24px';
  box.style.boxShadow = '0 4px 32px rgba(0,0,0,0.25)';
  box.style.textAlign = 'center';
  box.innerHTML = '<h1 style="color:#e11d48;font-size:2.5rem;margin-bottom:24px;">🚨 NEW BOOKING!</h1>';
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop Alarm';
  stopBtn.style.background = '#e11d48';
  stopBtn.style.color = '#fff';
  stopBtn.style.fontSize = '1.3rem';
  stopBtn.style.fontWeight = 'bold';
  stopBtn.style.padding = '18px 36px';
  stopBtn.style.border = 'none';
  stopBtn.style.borderRadius = '32px';
  stopBtn.style.boxShadow = '0 2px 16px rgba(0,0,0,0.18)';
  stopBtn.style.cursor = 'pointer';
  stopBtn.onclick = hideBookingAlertModal;
  box.appendChild(stopBtn);
  modal.appendChild(box);
  document.body.appendChild(modal);
}

function hideBookingAlertModal() {
  const modal = document.getElementById('booking-alert-modal');
  if (modal) modal.remove();
}

// --- Desktop Notification ---
function showDesktopNotification(title, body) {
  if (window.Notification && Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (window.Notification && Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    });
  }
}

// --- Single Beep (Web Audio API) ---
function playSingleBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.2;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 1000); // 1 second beep
  } catch (e) {}
}

// --- Unified Alert for New Booking ---
function triggerBookingAlert() {
  showBookingAlertModal();
  playSingleBeep();
  showDesktopNotification('New Booking!', 'A new booking has been received.');
}

// --- Use for both Test Alarm and real bookings ---
