# Application de Gestion Gasoil (GasoilManager)

## Description
Application web complète pour la gestion de consommation de gasoil, flotte de véhicules et statistiques.

## Architecture
- **Frontend**: HTML5, CSS3 (Design Premium), JavaScript Vanilla.
- **Backend**: Spring Boot 3, Java 17.
- **Base de Données**: Microsoft SQL Server.

## Installation

### 1. Frontend
Ouvrez simplement le fichier `frontend/index.html` dans votre navigateur.
L'interface est entièrement fonctionnelle avec des données de démonstration (Mock) si le backend n'est pas lancé.

### 2. Backend (Spring Boot)
1. Assurez-vous d'avoir Java 17 et Maven installés.
2. Configurez votre base de données SQL Server et mettez à jour `backend/src/main/resources/application.properties`.
3. Lancez l'application :
   ```bash
   cd backend
   mvn spring-boot:run
   ```

## Fonctionnalités
- **Calculateur**: Calcul automatique (Standard & Frigo) et détection des dépassements.
- **Flotte**: Liste des véhicules avec recherche.
- **Tableau de bord**: Graphiques et KPIs en temps réel.
- **Export**: Options d'export CSV.

## Design
L'interface utilise un design "Glassmorphism" sombre avec des animations fluides pour une expérience utilisateur premium.
