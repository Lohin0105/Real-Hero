// frontend/src/utils/mobileUtils.js
/**
 * Mobile optimization utilities
 */

/**
 * Detect if user is on a mobile device
 */
export const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Common mobile-friendly button styles for MUI
 */
export const mobileButtonStyles = {
    minHeight: 48, // Touch-friendly minimum
    fontSize: { xs: '0.875rem', md: '0.875rem' },
};

/**
 * Full-width button on mobile, auto on desktop
 */
export const mobileFullWidthButton = {
    ...mobileButtonStyles,
    width: { xs: '100%', md: 'auto' },
};

/**
 * Open phone dialer with proper mobile support
 * @param {string} phone - Phone number
 */
export const openPhoneDialer = (phone) => {
    if (!phone) return;
    const phoneNumber = phone.toString().replace(/\D/g, ''); // Remove non-digits
    const telUrl = `tel:${phoneNumber}`;

    if (isMobileDevice()) {
        window.location.href = telUrl;
    } else {
        window.open(telUrl);
    }
};

/**
 * Open URL with proper mobile support
 * On mobile, use window.location.href to allow app integration
 * On desktop, open in new tab
 * @param {string} url - URL to open
 */
export const openUrl = (url) => {
    if (!url) return;

    if (isMobileDevice()) {
        window.location.href = url;
    } else {
        window.open(url, '_blank');
    }
};

/**
 * Get auto-refresh interval based on device type
 * Mobile devices get longer intervals to save battery and data
 * @param {number} desktopInterval - Interval in milliseconds for desktop
 * @returns {number} Appropriate interval for current device
 */
export const getAutoRefreshInterval = (desktopInterval = 12000) => {
    return isMobileDevice() ? desktopInterval * 2.5 : desktopInterval;
};

/**
 * Common mobile-responsive spacing
 */
export const mobileSpacing = {
    px: { xs: 2, md: 6 },
    py: { xs: 2, md: 3 },
};

/**
 * Mobile-friendly card padding
 */
export const mobileCardPadding = {
    p: { xs: 2, md: 3 },
};
