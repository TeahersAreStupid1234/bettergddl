// Save options to chrome.storage
function saveOptions() {
    const useOutlierRemoval = document.getElementById('toggleOutlier').checked;
    const roundingMethod = document.getElementById('roundingMethod').value; // "round", "floor", "ceil", or "custom"
    const customThreshold = parseFloat(document.getElementById('customThreshold').value);
    
    chrome.storage.sync.set({ useOutlierRemoval, roundingMethod, customThreshold }, () => {
      const status = document.getElementById('status');
      status.textContent = 'Settings saved!';
      setTimeout(() => { status.textContent = ''; }, 2000);
    });
  }
    
  // Restore options from chrome.storage
  function restoreOptions() {
    chrome.storage.sync.get(['useOutlierRemoval', 'roundingMethod', 'customThreshold'], (items) => {
      document.getElementById('toggleOutlier').checked = items.useOutlierRemoval !== undefined ? items.useOutlierRemoval : true;
      document.getElementById('roundingMethod').value = items.roundingMethod || 'round';
      document.getElementById('customThreshold').value = items.customThreshold !== undefined ? items.customThreshold : 0.78;
    });
  }
    
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('save').addEventListener('click', saveOptions);