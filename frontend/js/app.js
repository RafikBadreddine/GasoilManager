/**
 * Gasoil Management App
 * Logic for Calculator, Fleet, Dashboard, and Export
 */

const API_URL = 'http://localhost:3000/api';

// --- State Management ---
const AppState = {
    vehicles: [],
    trips: [], // Stores consumption records
    currentView: 'dashboard'
};

// --- DOM Elements ---
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');
const currentDateEl = document.getElementById('current-date');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    updateDate();

    // Charger les données depuis le backend
    await fetchAllData();

    loadView('dashboard');
});

async function fetchAllData() {
    try {
        const [vRes, tRes] = await Promise.all([
            fetch(`${API_URL}/vehicles`),
            fetch(`${API_URL}/trips`)
        ]);

        if (vRes.ok) AppState.vehicles = await vRes.json();
        if (tRes.ok) AppState.trips = await tRes.json();

    } catch (error) {
        console.error("Erreur connexion API:", error);
        // On ne bloque pas l'UI, mais les listes seront vides
    }
}

function updateDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.innerText = new Date().toLocaleDateString('fr-FR', options);
}

// --- Navigation ---
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // styling
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // logic
            const target = item.dataset.target;
            loadView(target);
        });
    });
}

function loadView(viewName) {
    AppState.currentView = viewName;
    contentArea.innerHTML = ''; // clear current
    contentArea.classList.remove('animate-fade-in');

    // Trigger reflow for animation
    void contentArea.offsetWidth;
    contentArea.classList.add('animate-fade-in');

    switch (viewName) {
        case 'dashboard':
            pageTitle.innerText = 'Tableau de bord';
            renderDashboard();
            break;
        case 'calculator':
            pageTitle.innerText = 'Calculateur de Consommation';
            renderCalculator();
            break;
        case 'fleet':
            pageTitle.innerText = 'Gestion de Flotte';
            renderFleet();
            break;
        case 'export':
            pageTitle.innerText = 'Export des Données';
            renderExport();
            break;
        case 'settings':
            pageTitle.innerText = 'Paramètres';
            renderSettings();
            break;
    }
}

// --- VIEWS RENDERING ---

// 1. DASHBOARD
function renderDashboard() {
    // Calculate Stats
    const totalFuel = AppState.trips.reduce((acc, trip) => acc + (parseFloat(trip.fuel) || 0), 0);
    const totalTrips = AppState.trips.length;
    // Vérification de sécurité pour le status (parfois undefined si ancienne donnée)
    const alertCount = AppState.trips.filter(t => t.status && t.status.toLowerCase() === 'dépassement').length;

    // --- Prepare Chart Data (Real Data) ---

    // 1. Évolution de la Conso (Trips)
    // On trie par date
    const sortedTrips = [...AppState.trips].sort((a, b) => new Date(a.date) - new Date(b.date));
    // On prend les 10 derniers trajets pour ne pas surcharger le graph
    const recentTrips = sortedTrips.slice(-10);

    const chartLabels = recentTrips.map(t => {
        const d = new Date(t.date);
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    });
    const chartDataPoints = recentTrips.map(t => parseFloat(t.fuel));

    // 2. Répartition par Type (Vehicles)
    const typeStats = { 'Camion': 0, 'Voiture': 0, 'Fourgon': 0, 'Frigo': 0 };
    AppState.vehicles.forEach(v => {
        // Normaliser la clé si besoin, ou utiliser tel quel si ça correspond aux options
        if (typeStats.hasOwnProperty(v.type)) {
            typeStats[v.type]++;
        }
    });
    const typeValues = Object.values(typeStats); // [Camion, Voiture, Fourgon, Frigo]
    const typeLabels = Object.keys(typeStats);

    contentArea.innerHTML = `
        <div class="dashboard-grid">
            <div class="stat-card">
                <div class="icon-wrapper blue"><i class="fa-solid fa-gas-pump"></i></div>
                <div class="stat-info">
                    <h3>Consommation Totale</h3>
                    <p class="value">${totalFuel.toFixed(1)} L</p>
                    <span class="trend positive">Global</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="icon-wrapper green"><i class="fa-solid fa-truck"></i></div>
                <div class="stat-info">
                    <h3>Flotte Active</h3>
                    <p class="value">${AppState.vehicles.length}</p>
                    <span class="sub-text">Véhicules enregistrés</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="icon-wrapper purple"><i class="fa-solid fa-route"></i></div>
                <div class="stat-info">
                    <h3>Trajets Total</h3>
                    <p class="value">${totalTrips}</p>
                    <span class="sub-text">Historique complet</span>
                </div>
            </div>
            <div class="stat-card" id="card-alerts" style="cursor: pointer;">
                <div class="icon-wrapper red"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="stat-info">
                    <h3>Alertes Conso</h3>
                    <p class="value">${alertCount}</p>
                    <span class="trend negative">${alertCount > 0 ? 'Dépassements détectés' : 'Aucune alerte'}</span>
                </div>
            </div>
        </div>

        <div class="charts-section">
            <div class="chart-container glass-panel">
                <h3><i class="fa-solid fa-chart-line"></i> Évolution de la Consommation (10 derniers trajets)</h3>
                <canvas id="consoChart"></canvas>
            </div>
            <div class="chart-container glass-panel">
                <h3><i class="fa-solid fa-chart-bar"></i> Répartition par Type</h3>
                <canvas id="typeChart"></canvas>
            </div>
        </div>
    `;

    // Initialize Charts (using Chart.js)
    setTimeout(() => {
        initDashboardCharts(chartLabels, chartDataPoints, typeLabels, typeValues);
        setupTopBarInteractions();

        // Listener spécifique pour la carte d'alertes
        document.getElementById('card-alerts').addEventListener('click', () => {
            const alerts = AppState.trips.filter(t => t.status && t.status.toLowerCase() === 'dépassement');

            if (alerts.length > 0) {
                let msg = `⚠️ DÉTAILS DES ALERTES (${alerts.length})\n\n`;
                alerts.forEach(t => {
                    const vehicle = AppState.vehicles.find(v => v.id === t.vehicleId);
                    const plate = vehicle ? vehicle.plate : 'Véhicule Inconnu';
                    const date = new Date(t.date).toLocaleDateString('fr-FR');
                    msg += `- ${plate} le ${date} (Conso: ${t.consumption.toFixed(1)})\n`;
                });
                alert(msg);
            } else {
                alert("✅ Aucune alerte de surconsommation pour le moment.");
            }
        });

    }, 100);
}

function initDashboardCharts(lineLabels, lineData, doughnutLabels, doughnutData) {
    const ctx1 = document.getElementById('consoChart').getContext('2d');
    const gradient = ctx1.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');

    new Chart(ctx1, {
        type: 'line',
        data: {
            labels: lineLabels,
            datasets: [{
                label: 'Carburant (L)',
                data: lineData,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    const ctx2 = document.getElementById('typeChart').getContext('2d');
    new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: doughnutLabels,
            datasets: [{
                data: doughnutData,
                backgroundColor: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b'], // Added color for Fourgon
                borderWidth: 0
            }]
        },
        options: {
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
        }
    });
}

// --- Top Bar Actions (Notifications & Settings) ---
function setupTopBarInteractions() {
    // Select by icon class since they don't have IDs in HTML (checking top-actions container)
    const notifBtn = document.querySelector('.top-actions .fa-bell')?.parentElement;
    const settingsBtn = document.querySelector('.top-actions .fa-gear')?.parentElement;

    if (notifBtn && !notifBtn.hasAttribute('data-initialized')) {
        notifBtn.setAttribute('data-initialized', 'true');
        notifBtn.addEventListener('click', () => {
            const alerts = AppState.trips.filter(t => t.status && t.status.toLowerCase() === 'dépassement');

            if (alerts.length > 0) {
                let msg = `🔔 ALERTES DE SURCONSOMMATION (${alerts.length})\n\n`;
                alerts.forEach(t => {
                    const vehicle = AppState.vehicles.find(v => v.id === t.vehicleId);
                    const plate = vehicle ? vehicle.plate : 'Véhicule Inconnu';
                    const date = new Date(t.date).toLocaleDateString('fr-FR');
                    msg += `- ${plate} le ${date} (Conso: ${t.consumption.toFixed(1)})\n`;
                });
                alert(msg);
            } else {
                alert("🔔 NOTIFICATIONS\n\nAucune nouvelle notification.\nTout est calme pour le moment.");
            }
        });
    }
}

// 2. CALCULATOR
function renderCalculator() {
    contentArea.innerHTML = `
        <div class="form-container animate-fade-in">
            <form id="calc-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Date du trajet</label>
                        <input type="date" id="c-date" required>
                    </div>
                    <div class="form-group">
                        <label>Véhicule (Matricule)</label>
                        <!-- Input intelligent pour saisie partielle + Auto-complete -->
                        <div style="position: relative;">
                            <input type="text" id="c-plate-input" placeholder="Commencez à taper le matricule..." required autocomplete="off">
                            <input type="hidden" id="c-vehicle-id">
                            <div id="plate-feedback" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 0.8rem; color: var(--text-muted);"></div>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Société</label>
                        <input type="text" id="c-company" readonly placeholder="Auto-rempli">
                    </div>
                    <div class="form-group">
                        <label>Chauffeur</label>
                        <input type="text" id="c-driver" readonly placeholder="Auto-rempli">
                    </div>
                </div>

                <div class="form-group">
                    <label>Type de véhicule</label>
                    <input type="text" id="c-type" readonly placeholder="Auto-rempli">
                </div>

                <div id="standard-fields">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Km Départ</label>
                            <input type="number" id="c-km-start" placeholder="ex: 120000">
                        </div>
                        <div class="form-group">
                            <label>Km Arrivée</label>
                            <input type="number" id="c-km-end" placeholder="ex: 120500">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Distance Parcourue (Km)</label>
                        <input type="number" id="c-distance" readonly>
                    </div>
                </div>

                <div id="frigo-fields" style="display: none;">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Heures Départ</label>
                            <input type="number" id="c-hours-start" placeholder="ex: 1000">
                        </div>
                        <div class="form-group">
                            <label>Heures Arrivée</label>
                            <input type="number" id="c-hours-end" placeholder="ex: 1008">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Durée de fonctionnement (H)</label>
                        <input type="number" id="c-hours" readonly placeholder="Calcul auto">
                    </div>
                </div>

                <div class="form-group">
                    <label>Carburant consommé (Litres)</label>
                    <input type="number" id="c-fuel" required placeholder="Quantité de gasoil">
                </div>

                <button type="submit" class="primary-btn">
                    <i class="fa-solid fa-calculator"></i> Calculer la consommation
                </button>
            </form>

            <div id="calc-result" class="glass-panel" style="margin-top: 2rem; display: none; text-align: center;">
                <h3>Résultat du Calcul</h3>
                <div style="font-size: 2.5rem; font-weight: 700; margin: 1rem 0;" id="res-value">-- L/100km</div>
                <div id="res-status" class="status-badge status-normal" style="display: inline-block; font-size: 1rem;">Normal</div>
                <p id="res-limit" style="margin-top: 1rem; color: var(--text-muted);">Limite autorisée: <span id="limit-val">--</span></p>
                <button id="save-trip" class="primary-btn" style="margin-top: 1rem; background: var(--success);">Enregistrer</button>
            </div>
        </div>
    `;

    // Attach Listeners
    const plateInput = document.getElementById('c-plate-input');
    const vehicleIdInput = document.getElementById('c-vehicle-id');
    const kmStart = document.getElementById('c-km-start');
    const kmEnd = document.getElementById('c-km-end');
    const hoursStart = document.getElementById('c-hours-start');
    const hoursEnd = document.getElementById('c-hours-end');

    // Logic: Auto-complete on Enter or Tab (Blur)
    const handleAutoComplete = () => {
        const val = plateInput.value.trim().toLowerCase();
        if (!val) return;

        // Find matches that start with the input sequence
        const match = AppState.vehicles.find(v => v.plate.toLowerCase().startsWith(val));

        if (match) {
            // Auto-fill everything
            plateInput.value = match.plate; // Complete the text
            vehicleIdInput.value = match.id;
            document.getElementById('c-company').value = match.company;
            document.getElementById('c-driver').value = match.driver;
            document.getElementById('c-type').value = match.type;
            document.getElementById('plate-feedback').innerHTML = '<i class="fa-solid fa-check" style="color: var(--success)"></i>';

            // Toggle fields based on type
            if (match.type === 'Frigo') {
                document.getElementById('standard-fields').style.display = 'none';
                document.getElementById('frigo-fields').style.display = 'block';
            } else {
                document.getElementById('standard-fields').style.display = 'block';
                document.getElementById('frigo-fields').style.display = 'none';
            }
        } else {
            // Not found
            vehicleIdInput.value = ''; // Reset ID
            document.getElementById('plate-feedback').innerHTML = '<span style="color: var(--danger)">Introuvable</span>';
        }
    };

    plateInput.addEventListener('blur', handleAutoComplete);
    plateInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submit
            handleAutoComplete();
        }
    });

    // Reset feedback on typing
    plateInput.addEventListener('input', () => {
        document.getElementById('plate-feedback').innerHTML = '';
        if (plateInput.value === '') {
            vehicleIdInput.value = '';
            document.getElementById('c-company').value = '';
            document.getElementById('c-driver').value = '';
            document.getElementById('c-type').value = '';
        }
    });

    // Auto-calc distance
    [kmStart, kmEnd].forEach(el => {
        el.addEventListener('input', () => {
            const s = parseFloat(kmStart.value) || 0;
            const e = parseFloat(kmEnd.value) || 0;
            if (e > s) {
                document.getElementById('c-distance').value = (e - s).toFixed(1);
            }
        });
    });

    // Auto-calc hours (Frigo)
    [hoursStart, hoursEnd].forEach(el => {
        el.addEventListener('input', () => {
            const s = parseFloat(hoursStart.value) || 0;
            const e = parseFloat(hoursEnd.value) || 0;
            if (e > s) {
                document.getElementById('c-hours').value = (e - s).toFixed(1);
            }
        });
    });

    // Submit Calculation
    document.getElementById('calc-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const vId = parseInt(vehicleIdInput.value);
        if (!vId) {
            alert("Veuillez saisir un matricule valide (autocomplétion).");
            return;
        }
        const vehicle = AppState.vehicles.find(v => v.id === vId);
        const fuel = parseFloat(document.getElementById('c-fuel').value);

        let consumption = 0;
        let unit = 'L/100km';

        if (vehicle.type === 'Frigo') {
            const hours = parseFloat(document.getElementById('c-hours').value);
            if (!hours) return alert('Veuillez entrer les heures (Départ/Arrivée).');

            consumption = (fuel / hours); // Litres / Heure
            unit = 'L/H';
        } else {
            const dist = parseFloat(document.getElementById('c-distance').value);
            if (!dist) return alert('Veuillez entrer la distance.');
            consumption = (fuel / dist) * 100;
        }

        // Show Result
        const resultDiv = document.getElementById('calc-result');
        const resValue = document.getElementById('res-value');
        const resStatus = document.getElementById('res-status');
        const resLimit = document.getElementById('limit-val');

        resultDiv.style.display = 'block';
        resValue.innerText = `${consumption.toFixed(2)} ${unit}`;
        resLimit.innerText = `${vehicle.maxConso} ${unit}`;

        if (consumption > vehicle.maxConso) {
            resStatus.innerText = 'DÉPASSEMENT';
            resStatus.className = 'status-badge status-alert';
        } else {
            resStatus.innerText = 'NORMAL';
            resStatus.className = 'status-badge status-normal';
        }

        // Handle Save (API)
        document.getElementById('save-trip').onclick = async () => {
            const tripData = {
                date: document.getElementById('c-date').value,
                vehicleId: vehicle.id,
                consumption: consumption,
                fuel: fuel,
                status: consumption > vehicle.maxConso ? 'Dépassement' : 'Normal',
                distance: parseFloat(document.getElementById('c-distance').value) || null,
                hours: parseFloat(document.getElementById('c-hours').value) || null
            };

            try {
                const res = await fetch(`${API_URL}/trips`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tripData)
                });

                if (res.ok) {
                    await fetchAllData();
                    alert('Enregistré avec succès !');
                    loadView('dashboard');
                } else {
                    alert('Erreur lors de l\'enregistrement');
                }
            } catch (err) {
                console.error(err);
                alert("Erreur serveur");
            }
        };
    });
}

// 3. FLEET
function renderFleet() {
    contentArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div class="search-bar" style="background: var(--bg-card); padding: 0.5rem 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem; border: 1px solid var(--border-color);">
                <i class="fa-solid fa-search" style="color: var(--text-muted);"></i>
                <input type="text" id="fleet-search" placeholder="Rechercher un véhicule..." style="border: none; background: transparent; padding: 0; width: 250px; color: white;">
            </div>
            <div style="display: flex; gap: 1rem;">
                <button class="primary-btn" style="width: auto; margin: 0; background: var(--bg-card); border: 1px solid var(--border-color);"><i class="fa-solid fa-file-csv"></i> Import CSV</button>
                <button id="btn-add-vehicle" class="primary-btn" style="width: auto; margin: 0;"><i class="fa-solid fa-plus"></i> Nouveau Véhicule</button>
            </div>
        </div>

        <!-- Add Vehicle Form (Hidden by default) -->
        <div id="add-vehicle-panel" class="glass-panel animate-fade-in" style="display: none; margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem;">Ajouter un Véhicule</h3>
            <form id="add-vehicle-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Matricule</label>
                        <input type="text" id="new-plate" required placeholder="ex: 1234-A-50">
                    </div>
                    <div class="form-group">
                        <label>Société</label>
                        <input type="text" id="new-company" required placeholder="ex: Transport SA">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Chauffeur</label>
                        <input type="text" id="new-driver" required placeholder="Nom du chauffeur">
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="new-type" required>
                            <option value="Camion">Camion</option>
                            <option value="Voiture">Voiture</option>
                            <option value="Fourgon">Fourgon</option>
                            <option value="Frigo">Frigo</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Consommation Max (L/100 ou L/H)</label>
                    <input type="number" id="new-max" required placeholder="ex: 30">
                </div>
                <button type="submit" class="primary-btn">Enregistrer le Véhicule</button>
            </form>
        </div>

        <div class="table-container animate-fade-in">
            <table>
                <thead>
                    <tr>
                        <th>Matricule</th>
                        <th>Société</th>
                        <th>Chauffeur</th>
                        <th>Type</th>
                        <th>Conso Max</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="fleet-table-body">
                    ${renderFleetRows(AppState.vehicles)}
                </tbody>
            </table>
        </div>
    `;

    // Toggle Add Form
    document.getElementById('btn-add-vehicle').addEventListener('click', () => {
        const panel = document.getElementById('add-vehicle-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    // Handle Add Submit
    document.getElementById('add-vehicle-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const vehicleData = {
            plate: document.getElementById('new-plate').value,
            company: document.getElementById('new-company').value,
            driver: document.getElementById('new-driver').value,
            type: document.getElementById('new-type').value,
            maxConso: parseFloat(document.getElementById('new-max').value)
        };

        try {
            const res = await fetch(`${API_URL}/vehicles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(vehicleData)
            });

            if (res.ok) {
                const savedVehicle = await res.json();
                AppState.vehicles.push(savedVehicle); // Ajoute le véhicule retourné par la DB (avec le vrai ID)
                renderFleet();
                document.getElementById('add-vehicle-form').reset();
                alert("Véhicule ajouté avec succès !");
            } else {
                alert("Erreur lors de l'ajout du véhicule");
            }
        } catch (err) {
            console.error(err);
            alert("Erreur connexion serveur");
        }
    });

    // Search filter
    document.getElementById('fleet-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = AppState.vehicles.filter(v =>
            v.plate.toLowerCase().includes(term) ||
            v.driver.toLowerCase().includes(term) ||
            v.company.toLowerCase().includes(term)
        );
        document.getElementById('fleet-table-body').innerHTML = renderFleetRows(filtered);
    });

    // Attach Delete Listeners (delegate)
    document.getElementById('fleet-table-body').addEventListener('click', async (e) => {
        if (e.target.closest('.delete-btn')) {
            const btn = e.target.closest('.delete-btn');
            const id = parseInt(btn.dataset.id);
            if (confirm('Supprimer ce véhicule ?')) {
                try {
                    const res = await fetch(`${API_URL}/vehicles/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        await fetchAllData();
                        renderFleet();
                    }
                } catch (err) {
                    console.error(err);
                    alert("Erreur suppression");
                }
            }
        }
    });
}

function renderFleetRows(vehicles) {
    if (vehicles.length === 0) return '<tr><td colspan="6" style="text-align:center; opacity:0.7;">Aucun véhicule trouvé</td></tr>';
    return vehicles.map(v => `
        <tr>
            <td><strong>${v.plate}</strong></td>
            <td>${v.company}</td>
            <td>${v.driver}</td>
            <td><span class="status-badge" style="background: rgba(59, 130, 246, 0.1); color: var(--primary);">${v.type}</span></td>
            <td>${v.maxConso} ${v.type === 'Frigo' ? 'L/H' : 'L/100'}</td>
            <td>
                <button class="icon-btn" style="width: 30px; height: 30px;"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn delete-btn" data-id="${v.id}" style="width: 30px; height: 30px; color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// 4. EXPORT
function renderExport() {
    contentArea.innerHTML = `
        <div class="glass-panel animate-fade-in" style="max-width: 600px; margin: 0 auto; text-align: center; padding: 3rem;">
            <div style="font-size: 4rem; color: var(--primary); margin-bottom: 1.5rem;">
                <i class="fa-solid fa-cloud-arrow-down"></i>
            </div>
            <h3>Exporter les Données</h3>
            <p style="color: var(--text-muted); margin-bottom: 2rem;">Téléchargez les rapports complets au format CSV pour l'analyse externe.</p>
            
            <div style="display: grid; gap: 1rem;">
                <button id="export-vehicles" class="primary-btn" style="background: var(--bg-card); border: 1px solid var(--border-color);">
                    <i class="fa-solid fa-file-csv"></i> Exporter la Liste des Véhicules
                </button>
                <button id="export-trips" class="primary-btn" style="background: var(--bg-card); border: 1px solid var(--border-color);">
                    <i class="fa-solid fa-route"></i> Exporter l'Historique des Trajets
                </button>
                <button id="export-all" class="primary-btn">
                    <i class="fa-solid fa-database"></i> EXPORT COMPLET (AIO)
                </button>
            </div>
        </div>
    `;

    document.getElementById('export-vehicles').addEventListener('click', () => {
        const csv = 'Matricule,Societe,Chauffeur,Type,MaxConso\n' +
            AppState.vehicles.map(v => `${v.plate},${v.company},${v.driver},${v.type},${v.maxConso}`).join('\n');
        downloadCSV('flotte_gasoil.csv', csv);
    });

    document.getElementById('export-trips').addEventListener('click', () => {
        const csv = 'Date,Matricule,Conso,Carburant,Statut\n' +
            AppState.trips.map(t => {
                const v = AppState.vehicles.find(vh => vh.id === t.vehicleId) || { plate: 'Inconnu' };
                return `${t.date},${v.plate},${t.consumption},${t.fuel},${t.status}`;
            }).join('\n');
        downloadCSV('trajets_gasoil.csv', csv);
    });

    document.getElementById('export-all').addEventListener('click', () => {
        alert("L'export complet combine les deux fichiers dans une archive (Simulation).");
        // Just downloading trips for now
        document.getElementById('export-trips').click();
    });
}

function downloadCSV(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// 5. SETTINGS (New)
function renderSettings() {
    contentArea.innerHTML = `
        <div class="glass-panel animate-fade-in" style="max-width: 600px; margin: 0 auto; padding: 2rem;">
            <h3><i class="fa-solid fa-sliders"></i> Configuration de l'Application</h3>
            <p style="color: var(--text-muted); margin-bottom: 2rem;">Personnalisez votre expérience Gasoil Manager.</p>

            <div class="setting-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--border-color);">
                <div>
                    <h4 style="margin: 0;">Mode Sombre</h4>
                    <span style="font-size: 0.9rem; color: var(--text-muted);">Activer/Désactiver le thème sombre</span>
                </div>
                <label class="switch">
                    <input type="checkbox" id="theme-switch" ${document.body.classList.contains('light-mode') ? '' : 'checked'}>
                    <span class="slider round"></span>
                </label>
            </div>

            <div class="setting-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--border-color);">
                <div>
                    <h4 style="margin: 0;">Unités de Mesure</h4>
                    <span style="font-size: 0.9rem; color: var(--text-muted);">Métrique (L, Km) ou Impérial (Gal, Miles)</span>
                </div>
                <select style="background: var(--bg-card); border: 1px solid var(--border-color); color: white; padding: 0.5rem; border-radius: 4px;">
                    <option value="metric">Métrique (L, Km)</option>
                    <option value="imperial" disabled>Impérial (Bientôt)</option>
                </select>
            </div>

            <div class="setting-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--border-color);">
                <div>
                    <h4 style="margin: 0;">Seuil d'Alerte Global</h4>
                    <span style="font-size: 0.9rem; color: var(--text-muted);">marge de tolérance avant alerte (%)</span>
                </div>
                <input type="number" value="0" style="width: 60px; background: var(--bg-card); border: 1px solid var(--border-color); color: white; padding: 0.5rem; border-radius: 4px; text-align: center;" disabled>
            </div>

            <div style="margin-top: 3rem; text-align: center;">
                <p style="color: var(--text-muted); font-size: 0.8rem;">Gasoil Manager v1.0.0</p>
                <p style="color: var(--text-muted); font-size: 0.8rem;">Support : support@gasoil-manager.com</p>
            </div>
        </div>
        
        <style>
            .switch {
                position: relative;
                display: inline-block;
                width: 50px;
                height: 24px;
            }
            .switch input { 
                opacity: 0;
                width: 0;
                height: 0;
            }
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #334155;
                transition: .4s;
                border-radius: 34px;
            }
            .slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            input:checked + .slider {
                background-color: var(--primary);
            }
            input:checked + .slider:before {
                transform: translateX(26px);
            }
        </style>
    `;

    // Logic for Theme Switcher
    const themeSwitch = document.getElementById('theme-switch');
    themeSwitch.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.remove('light-mode'); // Dark Mode (Default)
        } else {
            document.body.classList.add('light-mode'); // Light Mode
        }
    });
}
