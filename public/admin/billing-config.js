// Billing Configuration for SMART BHARAT HEALTH SERVICES
// This file can be easily updated when GST is available

const BILLING_CONFIG = {
  // Company Information
  company: {
    name: "SMART BHARAT HEALTH SERVICES",
    tagline: "Professional Healthcare & Diagnostic Services",
    phone: "+91-XXXXXXXXXX",
    email: "info@smartbharat.com",
    supportEmail: "support@smartbharat.com",
    address: "[Your Business Address]",
    website: "www.smartbharat.com"
  },

  // GST Configuration (for future use)
  gst: {
    enabled: false, // Set to true when GST is available
    number: "", // Add your GST number here
    percentage: 18, // Default GST percentage
    showGSTBreakdown: false // Show GST breakdown in invoice
  },

  // Invoice Settings
  invoice: {
    prefix: "INV",
    autoNumbering: true,
    includeTerms: true,
    includeFooter: true,
    defaultCurrency: "₹",
    language: "en-IN"
  },

  // Payment Terms
  paymentTerms: [
    "Payment is due upon receipt of this invoice",
    "Results will be available within 24-48 hours",
    "Please bring this invoice for sample collection",
    "For any queries, contact our customer support"
  ],

  // GST Terms (will be added when GST is available)
  gstTerms: [
    "GST will be applicable as per government regulations",
    "GST number will be provided upon registration",
    "All prices are inclusive of applicable taxes"
  ],

  // Invoice Footer
  footer: {
    thankYouMessage: "Thank you for choosing SMART BHARAT HEALTH SERVICES!",
    tagline: "Your health is our priority. We strive to provide the best healthcare services.",
    disclaimer: "This is a computer-generated invoice. No signature required."
  },

  // Styling
  styling: {
    primaryColor: "#4a90e2",
    secondaryColor: "#28a745",
    accentColor: "#ffc107",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  }
};

// Function to get GST terms based on configuration
function getGSTTerms() {
  return BILLING_CONFIG.gst.enabled ? BILLING_CONFIG.gstTerms : [];
}

// Function to calculate GST (for future use)
function calculateGST(amount) {
  if (!BILLING_CONFIG.gst.enabled) return 0;
  return (amount * BILLING_CONFIG.gst.percentage) / 100;
}

// Function to format currency
function formatCurrency(amount) {
  return `${BILLING_CONFIG.invoice.defaultCurrency}${amount.toFixed(2)}`;
}

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BILLING_CONFIG, getGSTTerms, calculateGST, formatCurrency };
} 