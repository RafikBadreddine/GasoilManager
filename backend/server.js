require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true, // Pour Azure, mettre false pour local si nécessaire
        trustServerCertificate: true // Accepter les certificats auto-signés
    }
};

// Connexion BDD
sql.connect(dbConfig).then(pool => {
    if (pool.connected) {
        console.log('✅ Connecté à SQL Server');
    }
}).catch(err => {
    console.error('❌ Erreur de connexion SQL :', err);
});

// --- ROUTES ---

// 1. Récupérer tous les véhicules
app.get('/api/vehicles', async (req, res) => {
    try {
        const result = await sql.query`SELECT * FROM Vehicles ORDER BY id DESC`;
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 2. Ajouter un véhicule
app.post('/api/vehicles', async (req, res) => {
    const { plate, company, driver, type, maxConso } = req.body;
    try {
        const result = await sql.query`
            INSERT INTO Vehicles (plate, company, driver, type, maxConso)
            OUTPUT INSERTED.id
            VALUES (${plate}, ${company}, ${driver}, ${type}, ${maxConso})
        `;
        res.json({ id: result.recordset[0].id, ...req.body });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 3. Supprimer un véhicule
app.delete('/api/vehicles/:id', async (req, res) => {
    try {
        await sql.query`DELETE FROM Vehicles WHERE id = ${req.params.id}`;
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 4. Récupérer tous les trajets
app.get('/api/trips', async (req, res) => {
    try {
        const result = await sql.query`SELECT * FROM Trips ORDER BY date DESC`;
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 5. Ajouter un trajet
app.post('/api/trips', async (req, res) => {
    const { vehicleId, date, distance, hours, fuel, consumption, status } = req.body;
    try {
        await sql.query`
            INSERT INTO Trips (vehicleId, date, distance, hours, fuel, consumption, status)
            VALUES (${vehicleId}, ${date}, ${distance}, ${hours}, ${fuel}, ${consumption}, ${status})
        `;
        res.json({ message: 'Trip saved' });
    } catch (err) {
        console.error('❌ Erreur lors de l\'ajout du trajet :', err);
        res.status(500).send(err.message);
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur Backend (API) démarré sur http://localhost:${PORT}`);
});
