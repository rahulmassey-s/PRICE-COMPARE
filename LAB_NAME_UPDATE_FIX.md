# Lab Name Update Fix

## Problem
When updating lab names in the admin dashboard, the changes were reflected in Firebase but not in the app's home page test cards. This was because the app was using the stored `labName` from the `testLabPrices` collection instead of the real-time lab data.

## Root Cause
The `testLabPrices` collection stores lab names as strings, but when lab names are updated in the admin dashboard, only the `labs` collection is updated immediately. The `testLabPrices` collection still contains the old lab names until the server endpoint syncs them. Additionally, the `labId` field was not being included in the `LabPrice` objects, preventing the real-time mapping from working.

## Solution
Modified the `lab-test-card.tsx` component to:

1. **Use Real-time Lab Data**: Always prioritize the real-time lab name from the `labs` collection via `labsMap[priceInfo.labId]`
2. **Fallback to Stored Data**: If real-time data isn't available, fall back to the stored `labName`
3. **Updated Cart Functionality**: Cart operations now use real-time lab names
4. **Updated Display Logic**: All lab name displays now use the real-time data
5. **Fixed Data Fetching**: Ensured `labId` is included in `LabPrice` objects from all data fetching functions
6. **Database Cleanup**: Updated `testLabPrices` collection to sync lab names with the `labs` collection

## Key Changes

### 1. Added Helper Function
```typescript
const getDisplayLabName = useCallback((priceInfo: LabPriceType) => {
  // Always use the real-time lab data from labsMap if available, fallback to stored labName
  return labsMap[priceInfo.labId] || priceInfo.labName || '';
}, [labsMap]);
```

### 2. Updated Lab Name Display
```typescript
// Always use the real-time lab data from labsMap if available, fallback to stored labName
const realTimeLabName = labsMap[priceInfo.labId];
const mainLabName = (realTimeLabName || priceInfo.labName || '').replace(/\s*lab$/i, '');
const displayLabName = realTimeLabName || priceInfo.labName || '';
```

### 3. Updated Cart Functions
- `handleAddToCart`: Now uses `getDisplayLabName(priceInfo)`
- `handleRemoveFromCart`: Now uses `getDisplayLabName(priceInfo)`
- `isItemInCart`: Now takes `priceInfo` instead of just `labName`

### 4. Fixed Data Fetching Functions
- `fetchAndAttachPricesToTests` in `page.tsx`: Now includes `labId` in `LabPrice` objects
- `fetchCompleteTestDetailsById` in `page.tsx`: Now includes `labId` in `LabPrice` objects  
- `fetchAndAttachPrices` in `lab-tests/page.tsx`: Now includes `labId` in `LabPrice` objects

## Testing

### Run the Test Script
```bash
node test-lab-name-update.js
```

This script will:
- Check current labs in the database
- Check testLabPrices entries
- Identify any mismatches
- Test the update functionality

### Manual Testing
1. Start the development server: `npm run dev`
2. Start the notification server: `cd server && npm start`
3. Go to admin dashboard and update a lab name
4. Check the home page - lab names should update immediately

## Benefits
- ✅ Lab name changes are now reflected immediately in the app
- ✅ No dependency on server endpoint for immediate updates
- ✅ Fallback mechanism ensures app works even if real-time data fails
- ✅ Cart functionality uses consistent lab names
- ✅ Better user experience with real-time updates

## Files Modified
- `src/components/lab-test-card.tsx` - Main component with real-time lab name support
- `src/app/page.tsx` - Fixed data fetching to include labId
- `src/app/lab-tests/page.tsx` - Fixed data fetching to include labId
- `LAB_NAME_UPDATE_FIX.md` - This documentation

## Server Endpoint
The existing server endpoint at `/update-lab-name` still works and syncs the `testLabPrices` collection, but it's no longer required for immediate app updates. 