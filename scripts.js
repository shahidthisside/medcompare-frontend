document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Functionality
    const themeToggle = document.getElementById('theme-toggle');
    
    // Check for saved theme preference or use device preference
    const savedTheme = localStorage.getItem('theme') || 
                      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    // Apply the saved theme
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Toggle theme when button is clicked
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
    
    // Add event listener to "Start Saving Now" button to scroll to search section
    const startSavingBtn = document.querySelector('.hero-content .btn-primary');
    if (startSavingBtn) {
        startSavingBtn.addEventListener('click', () => {
            document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    // Search
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('medicine-search');
    const scraperResults = document.getElementById('scraper-results');
    const searchForm = document.getElementById('search-form');

    if (!searchBtn || !searchInput || !scraperResults || !searchForm) {
        console.error('Search button, input, results container, or form not found:', { searchBtn, searchInput, scraperResults, searchForm });
        return;
    }

    async function fetchScrapedMedicines(query) {
        // Show loading spinner with progress bar
        scraperResults.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p class="loading-text">Searching for medicine prices...</p>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progress-fill"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Simulate progress while waiting for results
        const progressFill = document.getElementById('progress-fill');
        let progress = 0;
        const progressInterval = setInterval(() => {
            // Increment progress but slow down as it approaches 90%
            if (progress < 90) {
                progress += (90 - progress) / 50;
                progressFill.style.width = `${progress}%`;
            }
        }, 100);
        
        try {
            const response = await fetch('https://medcompare-backend-189015579943.us-central1.run.app/api/scrape', { // Updated URL here
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            
            // Clear the progress interval
            clearInterval(progressInterval);
            progressFill.style.width = '100%';
            
            if (!response.ok) throw new Error('Network error');
            const results = await response.json();
            if (results.error) throw new Error(results.error);
            
            // Short delay to show 100% completion
            setTimeout(() => {
                renderScrapedResults(results);
                // Removed the duplicate scrollIntoView here
            }, 300);
        } catch (error) {
            clearInterval(progressInterval);
            scraperResults.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Error loading results: ' + error.message + '</p>';
            console.error('Fetch scraped medicines error:', error);
        }
    }

    function renderScrapedResults(results) {
        scraperResults.innerHTML = '';
        
        // Add sorting controls
        const sortingControls = document.createElement('div');
        sortingControls.className = 'sorting-controls';
        sortingControls.innerHTML = `
            <label for="sort-select">Sort by price:</label>
            <select id="sort-select" class="sort-select">
                <option value="none">No sorting</option>
                <option value="asc">Price: Low to High</option>
                <option value="desc">Price: High to Low</option>
            </select>
        `;
        scraperResults.appendChild(sortingControls);
        
        // Process and group identical medicines
        const groupedMedicines = groupIdenticalMedicines(results);
        
        // Create website sections for each group
        for (const [website, products] of Object.entries(results)) {
            const websiteSection = document.createElement('div');
            websiteSection.className = 'website-section';
            websiteSection.innerHTML = `<h3 class="website-title">Results from ${website}</h3>`;
            
            if (!products || products.length === 0) {
                websiteSection.innerHTML += '<p>No results found.</p>';
            } else {
                const productGrid = document.createElement('div');
                productGrid.className = 'scraper-grid';
                productGrid.dataset.website = website;
                
                products.forEach(product => {
                    const card = document.createElement('div');
                    card.className = 'scraper-card';
                    card.dataset.price = extractNumericPrice(product.price);
                    card.dataset.medicineName = product.medicine.toLowerCase();
                    card.dataset.medicineGroup = findMedicineGroup(product, groupedMedicines);
                    
                    card.innerHTML = `
                        <div class="scraper-content">
                            <h4 class="scraper-product-number">Product ${product.number}</h4>
                            <p><strong>Medicine:</strong> ${product.medicine}</p>
                            <p><strong>Quantity:</strong> ${product.quantity}</p>
                            <p><strong>Price:</strong> ${product.price}</p>
                            <p><strong>Link:</strong> <a href="${product.link}" target="_blank" class="product-link">${product.link === "Link not found" ? "Not available" : "Visit Product"}</a></p>
                        </div>
                    `;
                    productGrid.appendChild(card);
                });
                websiteSection.appendChild(productGrid);
            }
            scraperResults.appendChild(websiteSection);
        }
        
        // Add event listener for sorting
        document.getElementById('sort-select').addEventListener('change', function() {
            sortResults(this.value);
        });
        
        // Create a dedicated comparison section after the results
        createComparisonSection(results, groupedMedicines);
    }

    // Extract numeric price from price string
    function extractNumericPrice(priceStr) {
        const match = priceStr.match(/[\d.]+/);
        return match ? parseFloat(match[0]) : 9999;
    }

    // Sort results based on price
    function sortResults(sortOrder) {
        const grids = document.querySelectorAll('.scraper-grid');
        
        grids.forEach(grid => {
            const cards = Array.from(grid.querySelectorAll('.scraper-card'));
            
            if (sortOrder === 'asc') {
                cards.sort((a, b) => parseFloat(a.dataset.price) - parseFloat(b.dataset.price));
            } else if (sortOrder === 'desc') {
                cards.sort((a, b) => parseFloat(b.dataset.price) - parseFloat(a.dataset.price));
            }
            
            // Re-append cards in the new order
            cards.forEach(card => grid.appendChild(card));
        });
    }

    // Group identical medicines across websites
    function groupIdenticalMedicines(results) {
        const allMedicines = [];
        const groups = {};
        let groupId = 0;
        
        // Collect all medicines from all websites
        for (const [website, products] of Object.entries(results)) {
            if (products && products.length > 0) {
                products.forEach(product => {
                    allMedicines.push({
                        website,
                        ...product,
                        normalizedName: product.medicine.toLowerCase().replace(/\s+/g, ' ').trim()
                    });
                });
            }
        }
        
        // Group medicines with similar names and quantities
        allMedicines.forEach(medicine => {
            // Check if this medicine belongs to an existing group
            let foundGroup = false;
            
            for (const gid in groups) {
                const group = groups[gid];
                const firstMed = group[0];
                
                // Compare medicine name (with some flexibility) and quantity
                if (isSimilarMedicine(medicine, firstMed)) {
                    group.push(medicine);
                    foundGroup = true;
                    break;
                }
            }
            
            // If no matching group, create a new one
            if (!foundGroup) {
                groups[groupId] = [medicine];
                groupId++;
            }
        });
        
        return groups;
    }

    // Check if two medicines are similar (same product with potential minor name differences)
    function isSimilarMedicine(med1, med2) {
        // Simple string similarity check
        const name1 = med1.normalizedName;
        const name2 = med2.normalizedName;
        
        // Check for exact match or if one name contains the other
        const nameMatch = name1 === name2 || 
                         name1.includes(name2) || 
                         name2.includes(name1);
                         
        // Check quantity similarity (if available)
        const qty1 = med1.quantity.toLowerCase();
        const qty2 = med2.quantity.toLowerCase();
        const qtyMatch = qty1 === qty2 || 
                        qty1.includes(qty2) || 
                        qty2.includes(qty1);
                        
        return nameMatch && qtyMatch;
    }

    // Find which group a medicine belongs to
    function findMedicineGroup(medicine, groupedMedicines) {
        for (const groupId in groupedMedicines) {
            for (const groupMedicine of groupedMedicines[groupId]) {
                if (groupMedicine.medicine === medicine.medicine && 
                    groupMedicine.quantity === medicine.quantity) {
                    return groupId;
                }
            }
        }
        return null;
    }

    // Create a dedicated comparison section with charts
    function createComparisonSection(results, groupedMedicines) {
        // Remove any existing comparison section first
        const existingSection = document.querySelector('.comparison-section');
        if (existingSection) {
            existingSection.remove();
        }
        
        // Create the comparison section container
        const comparisonSection = document.createElement('div');
        comparisonSection.className = 'comparison-section';
        comparisonSection.innerHTML = `
            <div class="container">
                <h2 class="section-title">Price Comparison</h2>
                <p class="comparison-description">Compare medicine prices per unit across different pharmacies</p>
            </div>
        `;
        
        const container = document.createElement('div');
        container.className = 'container';
        
        // Create a chart for price per unit comparison only
        const pricePerUnitChart = document.createElement('div');
        pricePerUnitChart.className = 'chart-box';
        pricePerUnitChart.innerHTML = `
            <h3 class="chart-title">Price Per Unit Comparison</h3>
            <div class="chart-wrapper">
                <canvas id="price-per-unit-chart"></canvas>
            </div>
            <p class="chart-description">This chart shows the price per unit (tablet/ml) for better comparison across different quantities</p>
        `;
        
        container.appendChild(pricePerUnitChart);
        comparisonSection.appendChild(container);
        
        // Add the comparison section after the results
        const resultsSection = document.getElementById('results-section');
        resultsSection.parentNode.insertBefore(comparisonSection, resultsSection.nextSibling);
        
        // Create only the price per unit chart
        createPricePerUnitChart(results);
    }
    
    // Create a chart comparing identical medicines across websites
    function createPriceComparisonChart(groupedMedicines) {
        // Find groups with medicines from multiple websites
        const comparisonGroups = [];
        
        for (const groupId in groupedMedicines) {
            const group = groupedMedicines[groupId];
            const websites = new Set(group.map(med => med.website));
            
            if (websites.size > 1) {
                comparisonGroups.push({
                    id: groupId,
                    medicines: group,
                    name: group[0].medicine,
                    quantity: group[0].quantity
                });
            }
        }
        
        if (comparisonGroups.length === 0) {
            // No comparable medicines found
            document.getElementById('price-comparison-chart').parentNode.innerHTML = 
                '<p class="no-data-message">No identical medicines found across different websites for comparison.</p>';
            return;
        }
        
        // Prepare data for the chart
        const datasets = [];
        const labels = comparisonGroups.map(group => `${group.name} (${group.quantity})`);
        
        // Get unique websites
        const allWebsites = new Set();
        comparisonGroups.forEach(group => {
            group.medicines.forEach(med => {
                allWebsites.add(med.website);
            });
        });
        
        // Colors for different websites
        const colors = {
            'Apollo': 'rgba(37, 99, 235, 0.7)',   // Blue
            'Netmeds': 'rgba(220, 38, 38, 0.7)',    // Red
            '1mg': 'rgba(5, 150, 105, 0.7)'         // Green
        };
        
        // Create a dataset for each website
        allWebsites.forEach(website => {
            const data = [];
            
            comparisonGroups.forEach(group => {
                // Find the medicine from this website in this group
                const medicine = group.medicines.find(med => med.website === website);
                
                if (medicine) {
                    data.push(extractNumericPrice(medicine.price));
                } else {
                    data.push(null); // No data for this website for this medicine
                }
            });
            
            datasets.push({
                label: website,
                data: data,
                backgroundColor: colors[website] || 'rgba(156, 163, 175, 0.7)', // Gray fallback
                borderColor: (colors[website] || 'rgba(156, 163, 175, 0.7)').replace('0.7', '1'),
                borderWidth: 1
            });
        });
        
        // Create the chart
        const ctx = document.getElementById('price-comparison-chart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Price Comparison for Identical Medicines'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ₹' + context.raw;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Price (₹)'
                        }
                    }
                }
            }
        });
    }
    
    // Create a chart comparing price per unit
    function createPricePerUnitChart(results) {
        // Extract unit prices where possible
        const unitPriceData = [];
        
        for (const [website, products] of Object.entries(results)) {
            if (products && products.length > 0) {
                products.forEach(product => {
                    const unitInfo = extractUnitInfo(product.medicine, product.quantity);
                    if (unitInfo.success) {
                        unitPriceData.push({
                            website: website,
                            medicine: product.medicine,
                            quantity: product.quantity,
                            price: extractNumericPrice(product.price),
                            units: unitInfo.units,
                            unitType: unitInfo.unitType,
                            pricePerUnit: extractNumericPrice(product.price) / unitInfo.units
                        });
                    }
                });
            }
        }
        
        if (unitPriceData.length === 0) {
            // No unit price data available
            document.getElementById('price-per-unit-chart').parentNode.innerHTML = 
                '<p class="no-data-message">Could not calculate price per unit for the medicines found.</p>';
            return;
        }
        
        // Group by medicine name and unit type
        const medicineGroups = {};
        unitPriceData.forEach(item => {
            const key = `${item.medicine}-${item.unitType}`;
            if (!medicineGroups[key]) {
                medicineGroups[key] = [];
            }
            medicineGroups[key].push(item);
        });
        
        // Prepare data for the chart
        const labels = [];
        const datasets = [];
        
        // Colors for different websites
        const colors = {
            'Apollo': 'rgba(37, 99, 235, 0.7)',   // Blue
            'Netmeds': 'rgba(220, 38, 38, 0.7)',    // Red
            '1mg': 'rgba(5, 150, 105, 0.7)'         // Green
        };
        
        // Create datasets by website
        const websiteData = {};
        
        Object.entries(medicineGroups).forEach(([key, items]) => {
            const [medicine, unitType] = key.split('-');
            const label = `${medicine} (per ${unitType})`;
            labels.push(label);
            
            items.forEach(item => {
                if (!websiteData[item.website]) {
                    websiteData[item.website] = {
                        label: item.website,
                        data: Array(labels.length - 1).fill(null),
                        backgroundColor: colors[item.website] || 'rgba(156, 163, 175, 0.7)',
                        borderColor: (colors[item.website] || 'rgba(156, 163, 175, 0.7)').replace('0.7', '1'),
                        borderWidth: 1
                    };
                }
                
                // Add data for this medicine
                websiteData[item.website].data.push(parseFloat(item.pricePerUnit.toFixed(2)));
                
                // Fill in nulls for other medicines
                while (websiteData[item.website].data.length < labels.length) {
                    websiteData[item.website].data.push(null);
                }
            });
        });
        
        // Convert websiteData to array of datasets
        datasets.push(...Object.values(websiteData));
        
        // Create the chart
        const ctx = document.getElementById('price-per-unit-chart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Price Per Unit Comparison'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ₹' + context.raw + ' per unit';
                            }
                        }
                    }
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Price per Unit (₹)'
                    }
                }
            }
        });
    }
    
    // Create a chart showing potential savings
    function createSavingsChart(groupedMedicines) {
        // Find groups with medicines from multiple websites
        const savingsData = [];
        
        for (const groupId in groupedMedicines) {
            const group = groupedMedicines[groupId];
            const websites = new Set(group.map(med => med.website));
            
            if (websites.size > 1) {
                // Find min and max prices in this group
                let minPrice = Infinity;
                let maxPrice = 0;
                let minPriceWebsite = '';
                let maxPriceWebsite = '';
                
                group.forEach(med => {
                    const price = extractNumericPrice(med.price);
                    if (price < minPrice) {
                        minPrice = price;
                        minPriceWebsite = med.website;
                    }
                    if (price > maxPrice) {
                        maxPrice = price;
                        maxPriceWebsite = med.website;
                    }
                });
                
                const savings = maxPrice - minPrice;
                const savingsPercent = (savings / maxPrice) * 100;
                
                savingsData.push({
                    medicine: group[0].medicine,
                    quantity: group[0].quantity,
                    minPrice: minPrice,
                    maxPrice: maxPrice,
                    savings: savings,
                    savingsPercent: savingsPercent,
                    minPriceWebsite: minPriceWebsite,
                    maxPriceWebsite: maxPriceWebsite
                });
            }
        }
        
        if (savingsData.length === 0) {
            // No savings data available
            document.getElementById('savings-chart').parentNode.innerHTML = 
                '<p class="no-data-message">No potential savings found for the medicines searched.</p>';
            return;
        }
        
        // Sort by savings amount (descending)
        savingsData.sort((a, b) => b.savings - a.savings);
        
        // Prepare data for the chart
        const labels = savingsData.map(item => `${item.medicine} (${item.quantity})`);
        const savingsValues = savingsData.map(item => item.savings);
        const savingsPercentValues = savingsData.map(item => item.savingsPercent);
        
        // Create the chart
        const ctx = document.getElementById('savings-chart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Savings Amount (₹)',
                        data: savingsValues,
                        backgroundColor: 'rgba(5, 150, 105, 0.7)',
                        borderColor: 'rgba(5, 150, 105, 1)',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Savings Percentage (%)',
                        data: savingsPercentValues,
                        backgroundColor: 'rgba(37, 99, 235, 0.7)',
                        borderColor: 'rgba(37, 99, 235, 1)',
                        borderWidth: 1,
                        type: 'line',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Potential Savings by Choosing the Lowest Price'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const dataIndex = context.dataIndex;
                                const datasetIndex = context.datasetIndex;
                                
                                if (datasetIndex === 0) {
                                    return `Savings: ₹${context.raw.toFixed(2)} (${savingsData[dataIndex].minPriceWebsite} vs ${savingsData[dataIndex].maxPriceWebsite})`;
                                } else {
                                    return `Savings: ${context.raw.toFixed(2)}%`;
                                }
                            }
                        }
                    }
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Savings Amount (₹)'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Savings Percentage (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        });
    }
    
    // Helper function to extract unit information from medicine quantity
    function extractUnitInfo(medicineName, quantityStr) {
        // Common unit patterns
        const patterns = [
            { regex: /(\d+)\s*tablets?/i, unitType: 'tablet' },
            { regex: /(\d+)\s*capsules?/i, unitType: 'capsule' },
            { regex: /(\d+)\s*ml/i, unitType: 'ml' },
            { regex: /(\d+)\s*l/i, unitType: 'liter', multiplier: 1000 },
            { regex: /(\d+)\s*g/i, unitType: 'gram' },
            { regex: /(\d+)\s*mg/i, unitType: 'mg', divisor: 1000 },
            { regex: /(\d+)\s*strips?/i, unitType: 'strip' }
        ];
        
        for (const pattern of patterns) {
            const match = quantityStr.match(pattern.regex);
            if (match) {
                let units = parseFloat(match[1]);
                
                // Apply multiplier or divisor if specified
                if (pattern.multiplier) {
                    units *= pattern.multiplier;
                }
                if (pattern.divisor) {
                    units /= pattern.divisor;
                }
                
                return {
                    success: true,
                    units: units,
                    unitType: pattern.unitType
                };
            }
        }
        
        return { success: false };
    }

    let debounceTimer;
    searchBtn.addEventListener('click', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = searchInput.value.trim();
            if (!query) {
                alert('Please enter a medicine name.');
                return;
            }
            // Scroll to results section immediately
            document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
            fetchScrapedMedicines(query);
        }, 300);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = searchInput.value.trim();
                if (!query) {
                    alert('Please enter a medicine name.');
                    return;
                }
                // Scroll to results section immediately
                document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
                fetchScrapedMedicines(query);
            }, 300);
        }
    });

    // Animations
    const animateElements = document.querySelectorAll('.animate-fadeIn');
    function checkVisibility() {
        animateElements.forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight - 50) {
                el.classList.add('visible');
            }
        });
    }
    window.addEventListener('scroll', checkVisibility);
    checkVisibility();
});