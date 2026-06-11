// Application State
let appState = {
    currentScreen: 'setup',
    sessionData: {
        iata: '',
        model: ''
    },
    scannedItems: [],
    itemCounter: 0
};

// Sample barcode data for testing
const sampleBarcodes = [
    'S123456789',
    'A987654321', 
    'SN-ABC-123',
    'AT-XYZ-789',
    '12345ABCDE',
    'TAG001234',
    'SER-2024-001',
    'AST-2024-002',
    'HW-987654',
    'INV-123456'
];

// DOM Elements - Will be initialized after DOM loads
let setupScreen, scanningScreen, iataCodeInput, modelSelect, startScanningBtn;
let backToSetupBtn, currentIataSpan, currentModelSpan, manualBarcodeInput;
let barcodeTypeSelect, addBarcodeBtn, generateSampleBtn, resultsTableBody;
let itemCountSpan, clearAllBtn, saveExportBtn, successModal, errorModal;
let closeModalBtn, closeErrorBtn, successMessage, errorMessage;

// Utility Functions
function getCurrentTimestamp() {
    return new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function getCurrentISOTimestamp() {
    return new Date().toISOString();
}

function generateRandomBarcode() {
    return sampleBarcodes[Math.floor(Math.random() * sampleBarcodes.length)];
}

function showError(message) {
    if (errorMessage && errorModal) {
        errorMessage.textContent = message;
        errorModal.classList.remove('hidden');
    } else {
        alert('Error: ' + message);
    }
}

function showSuccess(message) {
    if (successMessage && successModal) {
        successMessage.textContent = message;
        successModal.classList.remove('hidden');
    } else {
        alert('Success: ' + message);
    }
}

function hideModals() {
    if (successModal) successModal.classList.add('hidden');
    if (errorModal) errorModal.classList.add('hidden');
}

// Screen Navigation
function showScreen(screenName) {
    console.log('Switching to screen:', screenName);
    
    // Hide all screens
    if (setupScreen) setupScreen.classList.remove('active');
    if (scanningScreen) scanningScreen.classList.remove('active');
    
    // Show target screen
    if (screenName === 'setup') {
        if (setupScreen) setupScreen.classList.add('active');
        appState.currentScreen = 'setup';
    } else if (screenName === 'scanning') {
        if (scanningScreen) scanningScreen.classList.add('active');
        appState.currentScreen = 'scanning';
        updateSessionDisplay();
        if (manualBarcodeInput) manualBarcodeInput.focus();
    }
}

function updateSessionDisplay() {
    if (currentIataSpan) currentIataSpan.textContent = `IATA: ${appState.sessionData.iata}`;
    if (currentModelSpan) currentModelSpan.textContent = `Model: ${appState.sessionData.model}`;
}

// Form Validation
function validateSetupForm() {
    const iata = iataCodeInput ? iataCodeInput.value.trim() : '';
    const model = modelSelect ? modelSelect.value : '';
    
    console.log('Validating form - IATA:', iata, 'Model:', model);
    
    if (!iata) {
        showError('Please enter an IATA code or site name.');
        if (iataCodeInput) iataCodeInput.focus();
        return false;
    }
    
    if (!model) {
        showError('Please select a model.');
        if (modelSelect) modelSelect.focus();
        return false;
    }
    
    return true;
}

// Barcode Management
function addScannedItem(type, value) {
    if (!value || !value.trim()) {
        showError('Please enter a valid barcode value.');
        return false;
    }
    
    const item = {
        id: ++appState.itemCounter,
        type: type,
        value: value.trim(),
        timestamp: getCurrentTimestamp(),
        isoTimestamp: getCurrentISOTimestamp()
    };
    
    appState.scannedItems.push(item);
    updateResultsTable();
    
    if (manualBarcodeInput) {
        manualBarcodeInput.value = '';
        manualBarcodeInput.focus();
    }
    
    // Visual feedback
    const scanZone = document.querySelector('.scan-zone');
    if (scanZone) {
        scanZone.classList.add('scan-success');
        setTimeout(() => {
            scanZone.classList.remove('scan-success');
        }, 300);
    }
    
    return true;
}

function removeScannedItem(itemId) {
    appState.scannedItems = appState.scannedItems.filter(item => item.id !== itemId);
    updateResultsTable();
}

function clearAllItems() {
    if (appState.scannedItems.length === 0) {
        showError('No items to clear.');
        return;
    }
    
    if (confirm('Are you sure you want to clear all scanned items?')) {
        appState.scannedItems = [];
        updateResultsTable();
        showSuccess('All items have been cleared.');
    }
}

// Table Management
function updateResultsTable() {
    if (!resultsTableBody || !itemCountSpan) return;
    
    resultsTableBody.innerHTML = '';
    itemCountSpan.textContent = appState.scannedItems.length;
    
    if (appState.scannedItems.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="4" class="empty-state">
                <p>No items scanned yet. Start scanning to see results here.</p>
            </td>
        `;
        resultsTableBody.appendChild(emptyRow);
        return;
    }
    
    // Sort items by most recent first
    const sortedItems = [...appState.scannedItems].reverse();
    
    sortedItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="type-cell">${item.type}</td>
            <td class="value-cell">${item.value}</td>
            <td class="time-cell">${item.timestamp}</td>
            <td>
                <button class="delete-btn" onclick="removeScannedItem(${item.id})" title="Delete item">
                    ✕
                </button>
            </td>
        `;
        resultsTableBody.appendChild(row);
    });
}

// CSV Export
function generateCSV() {
    if (appState.scannedItems.length === 0) {
        showError('No items to export. Please scan some barcodes first.');
        return null;
    }
    
    const headers = ['IATA', 'Model', 'SerialNumber', 'AssetTag', 'Timestamp'];
    const csvContent = [headers.join(',')];
    
    // Group items by serial numbers and asset tags
    const serialNumbers = appState.scannedItems.filter(item => item.type === 'SerialNumber');
    const assetTags = appState.scannedItems.filter(item => item.type === 'AssetTag');
    
    // Create rows - if we have both serial numbers and asset tags, pair them up
    const maxItems = Math.max(serialNumbers.length, assetTags.length);
    
    if (maxItems === 0) {
        showError('No valid items to export.');
        return null;
    }
    
    for (let i = 0; i < maxItems; i++) {
        const serialNumber = serialNumbers[i] ? serialNumbers[i].value : '';
        const assetTag = assetTags[i] ? assetTags[i].value : '';
        const timestamp = serialNumbers[i] ? serialNumbers[i].isoTimestamp : 
                         (assetTags[i] ? assetTags[i].isoTimestamp : getCurrentISOTimestamp());
        
        const row = [
            `"${appState.sessionData.iata}"`,
            `"${appState.sessionData.model}"`,
            `"${serialNumber}"`,
            `"${assetTag}"`,
            `"${timestamp}"`
        ];
        
        csvContent.push(row.join(','));
    }
    
    return csvContent.join('\n');
}

function downloadCSV() {
    try {
        const csvContent = generateCSV();
        if (!csvContent) return;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `asset_scan_${appState.sessionData.iata}_${timestamp}.csv`;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showSuccess(`CSV exported successfully as "${filename}". ${appState.scannedItems.length} items exported.`);
        } else {
            throw new Error('Download not supported');
        }
    } catch (error) {
        console.error('Export error:', error);
        showError('Failed to export CSV file. Please try again.');
    }
}

// Initialize DOM Elements
function initializeDOMElements() {
    setupScreen = document.getElementById('setupScreen');
    scanningScreen = document.getElementById('scanningScreen');
    iataCodeInput = document.getElementById('iataCode');
    modelSelect = document.getElementById('modelSelect');
    startScanningBtn = document.getElementById('startScanningBtn');
    backToSetupBtn = document.getElementById('backToSetupBtn');
    currentIataSpan = document.getElementById('currentIata');
    currentModelSpan = document.getElementById('currentModel');
    manualBarcodeInput = document.getElementById('manualBarcodeInput');
    barcodeTypeSelect = document.getElementById('barcodeType');
    addBarcodeBtn = document.getElementById('addBarcodeBtn');
    generateSampleBtn = document.getElementById('generateSampleBtn');
    resultsTableBody = document.getElementById('resultsTableBody');
    itemCountSpan = document.getElementById('itemCount');
    clearAllBtn = document.getElementById('clearAllBtn');
    saveExportBtn = document.getElementById('saveExportBtn');
    successModal = document.getElementById('successModal');
    errorModal = document.getElementById('errorModal');
    closeModalBtn = document.getElementById('closeModalBtn');
    closeErrorBtn = document.getElementById('closeErrorBtn');
    successMessage = document.getElementById('successMessage');
    errorMessage = document.getElementById('errorMessage');
    
    console.log('DOM elements initialized');
    console.log('IATA input:', iataCodeInput);
    console.log('Model select:', modelSelect);
    console.log('Start button:', startScanningBtn);
}

// Setup Event Listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Setup screen events
    if (startScanningBtn) {
        startScanningBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Start scanning button clicked');
            if (validateSetupForm()) {
                appState.sessionData.iata = iataCodeInput.value.trim();
                appState.sessionData.model = modelSelect.value;
                console.log('Session data set:', appState.sessionData);
                showScreen('scanning');
            }
        });
        console.log('Start scanning button listener added');
    }
    
    // Scanning screen events
    if (backToSetupBtn) {
        backToSetupBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (appState.scannedItems.length > 0) {
                if (confirm('Going back will clear all scanned items. Are you sure?')) {
                    appState.scannedItems = [];
                    appState.itemCounter = 0;
                    showScreen('setup');
                    if (iataCodeInput) iataCodeInput.focus();
                }
            } else {
                showScreen('setup');
                if (iataCodeInput) iataCodeInput.focus();
            }
        });
    }
    
    if (addBarcodeBtn) {
        addBarcodeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const value = manualBarcodeInput ? manualBarcodeInput.value.trim() : '';
            const type = barcodeTypeSelect ? barcodeTypeSelect.value : 'SerialNumber';
            addScannedItem(type, value);
        });
    }
    
    if (generateSampleBtn) {
        generateSampleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const randomBarcode = generateRandomBarcode();
            if (manualBarcodeInput) {
                manualBarcodeInput.value = randomBarcode;
                manualBarcodeInput.focus();
            }
        });
    }
    
    if (manualBarcodeInput) {
        manualBarcodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = this.value.trim();
                const type = barcodeTypeSelect ? barcodeTypeSelect.value : 'SerialNumber';
                if (addScannedItem(type, value)) {
                    // Auto-switch type for convenience
                    if (barcodeTypeSelect) {
                        if (type === 'SerialNumber') {
                            barcodeTypeSelect.value = 'AssetTag';
                        } else {
                            barcodeTypeSelect.value = 'SerialNumber';
                        }
                    }
                }
            }
        });
    }
    
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', function(e) {
            e.preventDefault();
            clearAllItems();
        });
    }
    
    if (saveExportBtn) {
        saveExportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            downloadCSV();
        });
    }
    
    // Modal events
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            hideModals();
        });
    }
    
    if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', function(e) {
            e.preventDefault();
            hideModals();
        });
    }
    
    // Modal overlay clicks
    if (successModal) {
        successModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModals();
            }
        });
    }
    
    if (errorModal) {
        errorModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModals();
            }
        });
    }
    
    console.log('Event listeners setup complete');
}

// Keyboard Event Handlers
function setupKeyboardHandlers() {
    // Global keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // ESC to close modals
        if (e.key === 'Escape') {
            hideModals();
        }
        
        // F1 for help/info (prevent default browser help)
        if (e.key === 'F1') {
            e.preventDefault();
            if (appState.currentScreen === 'scanning') {
                showSuccess('Scanning Tips:\n• Use Enter to quickly add items\n• Type switches automatically between Serial Number and Asset Tag\n• Generate samples for testing');
            }
        }
        
        // Ctrl+S to save (when on scanning screen)
        if (e.ctrlKey && e.key === 's' && appState.currentScreen === 'scanning') {
            e.preventDefault();
            downloadCSV();
        }
    });
}

// Initialize Application
function initializeApp() {
    console.log('Initializing application...');
    
    try {
        initializeDOMElements();
        setupEventListeners();
        setupKeyboardHandlers();
        updateResultsTable();
        
        // Focus on first input
        if (iataCodeInput) {
            iataCodeInput.focus();
        }
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        alert('Application failed to initialize. Please refresh the page.');
    }
}

// Global functions for inline event handlers
window.removeScannedItem = removeScannedItem;

// DOM Ready Event
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded
    initializeApp();
}