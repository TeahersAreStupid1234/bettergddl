(function () {
    let useOutlierRemoval = true;
    let roundingMethod = 'round';
    let customThreshold = 0.78;
    const INTERNAL_THRESHOLD = 1.0;
    let isProcessing = false; // Prevents processing loops
    let lastProcessedUrl = null; // Tracks last processed page
    let processedUrls = {}; // Cache of processed URLs to prevent duplicates
    console.log('GD Ladder Rating Adjuster: Extension loaded');
    function detectUrlChange() {
        const currentUrl = window.location.href;
        if (lastProcessedUrl !== currentUrl) {
            console.log(`URL changed: ${lastProcessedUrl} → ${currentUrl}`);
            lastProcessedUrl = currentUrl;
            processedUrls[currentUrl] = false; // Mark as not processed
            waitForLevelInfo();
        }
    }
    // Polling Method (Detects URL changes every second)
    setInterval(() => {
        detectUrlChange();
    }, 1000);
    // Helper: Retrieve stored option
    function getStoredOption(option, defaultVal) {
        return new Promise((resolve) => {
            if (chrome && chrome.storage) {
                chrome.storage.sync.get([option], (items) => {
                    resolve(items[option] !== undefined ? items[option] : defaultVal);
                });
            } else {
                resolve(defaultVal);
            }
        });
    }
    async function loadOptions() {
    useOutlierRemoval = await getStoredOption('useOutlierRemoval', true);
    roundingMethod = await getStoredOption('roundingMethod', 'round');
    customThreshold = await getStoredOption('customThreshold', 0.78);

    console.log("[DEBUG] Options loaded:", { useOutlierRemoval, roundingMethod, customThreshold });
}
    async function processPage() {
        const currentUrl = window.location.href;
        if (isProcessing || processedUrls[currentUrl]) return;
        
        isProcessing = true;
    
        await loadOptions(); // ✅ Load options before calculation
    
        console.log("Processing page for rating adjustments...");
        
        const levelId = window.location.pathname.split('/').pop();
        if (!levelId || isNaN(levelId)) {
            console.warn("No valid level ID found.");
            isProcessing = false;
            return;
        }
    
        try {
            const response = await fetch(`https://gdladder.com/api/level/${levelId}/submissions/spread`);
            if (!response.ok) throw new Error(`Failed to fetch rating data (${response.status})`);
            
            const spreadData = await response.json();
            const allRatings = expandRatingData(spreadData);
    
            if (allRatings.length === 0) {
                console.warn("No ratings found.");
                isProcessing = false;
                return;
            }
    
            let finalRating, originalRating;
            originalRating = calculateFinalRating(allRatings); // ✅ Now, rounding works
    
            if (useOutlierRemoval) {
                const { filtered } = removeOutliers(allRatings);
                finalRating = calculateFinalRating(filtered);
            } else {
                finalRating = originalRating;
            }
    
            if (finalRating === null) {
                console.error("Failed to compute final rating.");
                isProcessing = false;
                return;
            }
    
            updateTierDisplay(finalRating, originalRating);
            processedUrls[currentUrl] = true; // Mark as processed
        } catch (error) {
            console.error("Error processing page ratings:", error);
        }
        
        isProcessing = false;
    }
    function waitForLevelInfo() {
        console.log("Checking for level info availability...");
        const tierElement = document.querySelector('p[class^="w-1/2 py-2 tier-"]');
        if (tierElement) {
            console.log("Level info found, processing page...");
            processPage();
            return;
        }
        setTimeout(waitForLevelInfo, 500);
    }
    // SPA Navigation Detection
    function setupUrlObserver() {
        let pushState = history.pushState;
        let replaceState = history.replaceState;
        history.pushState = function (...args) {
            pushState.apply(history, args);
            window.dispatchEvent(new Event('urlchange'));
        };
        history.replaceState = function (...args) {
            replaceState.apply(history, args);
            window.dispatchEvent(new Event('urlchange'));
        };
        window.addEventListener("urlchange", detectUrlChange);
        window.addEventListener("popstate", detectUrlChange);
    }
    // DOM Mutation Observer: Detects when new level elements load on the page
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                const tierElement = document.querySelector('p[class^="w-1/2 py-2 tier-"]');
                if (tierElement && !processedUrls[window.location.href]) {
                    console.log("DOM Mutation detected: Reprocessing...");
                    processPage();
                    break;
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    function expandRatingData(spreadData) {
        let expandedRatings = [];
        if (spreadData && spreadData.rating) {
            spreadData.rating.forEach(item => {
                for (let i = 0; i < item.Count; i++) expandedRatings.push(item.Rating);
            });
        }
        return expandedRatings;
    }
    // New function to determine the tier number based on rounding method
function determineTier(rating) {
    if (rating === null) return null;
    
    let tier;
    switch (roundingMethod) {
        case 'round':
            tier = Math.round(rating);
            break;
        case 'floor':
            tier = Math.floor(rating);
            break;
        case 'ceil':
            tier = Math.ceil(rating);
            break;
        case 'custom':
            const fraction = rating % 1;
            tier = fraction >= customThreshold ? Math.ceil(rating) : Math.floor(rating);
            break;
        default:
            tier = Math.round(rating);
    }
    
    // Ensure tier is within valid range (1-35)
    return Math.min(Math.max(tier, 1), 35);
}

// Keep calculateFinalRating simple - just return the average without rounding
function calculateFinalRating(ratings) {
    if (!ratings || ratings.length === 0) return null;
    return ratings.reduce((sum, val) => sum + val, 0) / ratings.length;
}
    
    function determineDisplayTier(rating) {
        if (rating === null) return null;
    
        let tier;
        switch (roundingMethod) {
            case 'round': 
                tier = Math.round(rating); 
                break;
            case 'floor': 
                tier = Math.floor(rating); 
                break;
            case 'ceil': 
                tier = Math.ceil(rating); 
                break;
            case 'custom': 
                const fraction = rating % 1;
                tier = fraction >= customThreshold ? Math.ceil(rating) : Math.floor(rating);
                break;
            default: 
                tier = Math.round(rating);
        }
    
        return Math.min(Math.max(tier, 1), 35); // Ensure tiers stay in range
    }
    function removeOutliers(ratings) {
        if (!ratings || ratings.length === 0) return { filtered: [], mean: null, std: null };
        const mean = calculateFinalRating(ratings);
        const squaredDiffs = ratings.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / ratings.length;
        const std = Math.sqrt(variance);
        return { filtered: ratings.filter(r => Math.abs(r - mean) <= INTERNAL_THRESHOLD * std) };
    }
    function updateTierDisplay(finalRating, originalRating) {
        // Ensure valid numbers before proceeding
        if (finalRating === null) return;
        if (originalRating === null) originalRating = finalRating; 
    
        // Determine tier (rounded) based on user settings
        let finalTier = determineDisplayTier(finalRating);
        let originalTier = determineDisplayTier(originalRating);
    
        const tierElement = document.querySelector('p[class^="w-1/2 py-2 tier-"]');
        if (!tierElement) return;
    
        // Function to show adjusted tier
        function displayFinal() {
            tierElement.className = `w-1/2 py-2 tier-${finalTier}`;
            tierElement.innerHTML = `
                <span class="text-xl font-bold">${finalTier}</span>
                <br>
                <span>[${finalRating.toFixed(2)}]</span> <!-- UNROUNDED finalRating -->
            `;
        }
    
        // Function to show original tier (if hovered)
        function displayOriginal() {
            tierElement.className = `w-1/2 py-2 tier-${originalTier}`;
            tierElement.innerHTML = `
                <span class="text-xl font-bold">${originalTier}</span>
                <br>
                <span>[${originalRating.toFixed(2)}]</span> <!-- UNROUNDED originalRating -->
            `;
        }
    
        // Handle hover effect for outlier removal
        if (useOutlierRemoval) {
            tierElement.onmouseover = displayOriginal;
            tierElement.onmouseout = displayFinal;
        }
    
        displayFinal();
    }
    setupUrlObserver();
    detectUrlChange();
})();
(function () {
    const OUTLIER_THRESHOLD = 1;
    let allSubmissions = [];
    let debounceTimeout = null;
  
    function debugLog(message, type = 'log') {
      const prefix = '[OUTLIER_DETECTION]';
      switch(type) {
        case 'warn': console.warn(`${prefix} ${message}`); break;
        case 'error': console.error(`${prefix} ${message}`); break;
        default: console.log(`${prefix} ${message}`);
      }
    }
  
    function calculateMean(numbers) {
      return numbers.length ? numbers.reduce((sum, num) => sum + num, 0) / numbers.length : 0;
    }
  
    function calculateStandardDeviation(numbers, mean) {
      if (numbers.length < 2) return 0;
      const variance =
        numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
      return Math.sqrt(variance);
    }
  
    async function fetchPageSubmissions(page = 1) {
      debugLog(`Fetching submissions for page ${page}...`);
      const levelId = window.location.pathname.split('/').pop();
      if (!levelId || isNaN(levelId)) {
        debugLog('Invalid level ID. Aborting.', 'warn');
        return [];
      }
      try {
        const apiUrl = `https://gdladder.com/api/level/${levelId}/submissions?page=${page}`;
        debugLog(`Fetching from URL: ${apiUrl}`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
          debugLog(`API request failed. Status: ${response.status}`, 'error');
          return [];
        }
        const data = await response.json();
        if (!data.submissions || data.submissions.length === 0) {
          debugLog('No submissions found', 'warn');
          return [];
        }
        // Map entries into standard format
        return data.submissions.map(sub => ({
          userId: sub.UserID,
          rating: sub.Rating,
          username: sub.User.Name
        }));
      } catch (error) {
        debugLog(`Unexpected error: ${error.message}`, 'error');
        return [];
      }
    }
  
    async function updateAndDetectOutliers(page = 1) {
      const fetchedSubmissions = await fetchPageSubmissions(page);
      if (fetchedSubmissions.length === 0) {
        debugLog('No new submissions to update');
        return;
      }
      // Merge new submissions to cache. (You might add a check here to avoid duplicate entries.)
      allSubmissions = allSubmissions.concat(fetchedSubmissions);
      debugLog(`Total cached submissions: ${allSubmissions.length}`);
      runOutlierDetection();
    }
  
    // Debounce helper to avoid repeated calculations if user is switching pages quickly.
    function runOutlierDetection() {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        const ratings = allSubmissions.map(sub => sub.rating);
        if (ratings.length === 0) {
          debugLog('No ratings available for outlier detection', 'warn');
          return;
        }
        const mean = calculateMean(ratings);
        const stdDev = calculateStandardDeviation(ratings, mean);
        debugLog(`Mean Rating: ${mean.toFixed(2)}`);
        debugLog(`Standard Deviation: ${stdDev.toFixed(2)}`);
        const outliers = allSubmissions.filter(
          sub => Math.abs(sub.rating - mean) > OUTLIER_THRESHOLD * stdDev
        );
        debugLog(`Detected ${outliers.length} outliers among ${allSubmissions.length} submissions`);
        localStorage.setItem('outliers', JSON.stringify(outliers));
        markOutliersInDOM(outliers);
      }, 500); // adjust the delay if needed
    }
  
    // Clear existing markers on the DOM (so duplicate markers won't be reattached)
    function clearMarkers() {
      const profileLinks = document.querySelectorAll('a.p-2.flex-grow.bg-gray-500[href^="/profile/"]');
      profileLinks.forEach(anchor => {
        // Remove style modifications if necessary.
        anchor.style.color = '';
        anchor.style.fontWeight = '';
        const pElem = anchor.querySelector('p');
        if (pElem) {
          const marker = pElem.querySelector('.outlier-marker');
          if (marker) {
            marker.remove();
          }
        }
      });
    }
  
    function markOutliersInDOM(outliers) {
      // First, check the setting to see if marking should be applied
      chrome.storage.sync.get('useOutlierRemoval', ({ useOutlierRemoval }) => {
        if (!useOutlierRemoval) {
          // If outlier removal is disabled, remove any existing markers and exit early
          clearMarkers();
          return;
        }
  
        // Otherwise, mark the outliers in the DOM
        clearMarkers(); // Clear any existing markers first
        const profileLinks = document.querySelectorAll('a.p-2.flex-grow.bg-gray-500[href^="/profile/"]');
        profileLinks.forEach(anchor => {
          const pElem = anchor.querySelector('p');
          if (!pElem) return;
          const text = pElem.textContent.trim();
          const matchingOutlier = outliers.find(o => text === o.username || text.startsWith(o.username));
          if (matchingOutlier) {
            anchor.style.color = 'red';
            anchor.style.fontWeight = 'bold';
            // Add marker if it hasn't already been added
            if (!pElem.querySelector('.outlier-marker')) {
              const warningSpan = document.createElement('span');
              warningSpan.textContent = ' ❌';
              warningSpan.style.marginLeft = '5px';
              warningSpan.classList.add('outlier-marker');
              pElem.appendChild(warningSpan);
            }
          }
        });
      });
    }
  
    // Instead of polling every 2000ms, you can use MutationObserver if the
    // DOM structure updates dynamically. Here, for simplicity, we keep
    // the interval but with a decreased frequency.
    function observePageChange() {
      let lastPage = document.querySelector('input[type="number"].outline-none')?.value;
      setInterval(() => {
        const pageInput = document.querySelector('input[type="number"].outline-none');
        if (pageInput) {
          const currentPage = pageInput.value;
          if (currentPage !== lastPage) {
            lastPage = currentPage;
            debugLog(`Page changed to ${currentPage}, fetching new data...`);
            updateAndDetectOutliers(currentPage);
          }
        }
      }, 1000); // shortened the interval
    }
  
    function init() {
      debugLog('Initializing outlier detection');
      // Start with page 1
      updateAndDetectOutliers(1);
      observePageChange();
    }
  
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('pageshow', init);
    window.addEventListener('load', init);
    window.addEventListener('popstate', init);
  
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes.useOutlierRemoval) {
        if (!changes.useOutlierRemoval.newValue) {
          // Outlier removal was turned off: clear all markers.
          clearMarkers();
        } else {
          // Option enabled: re-run outlier detection if needed.
          detectOutliersFromCache(); // or whichever function refreshes the marking
        }
      }
    });
  })();



