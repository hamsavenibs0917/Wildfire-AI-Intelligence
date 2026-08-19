# Wildfire AI Intelligence

An interactive web application for real-time Forest Reserve Safety Monitoring, Environmental Risk Calculation, Specific Forest Region Search, Visitor Safety Assistant, and Tourist Entry Pass Database Management.

---

## 🌟 Key Features Implemented

1. **Modern Responsive Design & Map Drawer (Inspired by Map Mockups)**:
   - Floating search bar overlay with risk level filters across 25 Indian Forest Reserves.
   - Interactive Leaflet map with color-coded risk markers and geofence boundary highlighting.
   - Side/bottom card sheet drawer displaying real-time microclimate sensors and action buttons.

2. **Tourist Entry Pass & Database Management System**:
   - Register entry passes with Primary Visitor Name, Contact Phone, Email, Forest Reserve, Permit Duration, Group Members Count, and Emergency Contact.
   - Live aggregated counters tracking **Total Group Members in Database**, Active Visitor Passes, Occupied Reserves, and Completed Visits.
   - Comprehensive, searchable SQLite database view with instant Status Toggle (`ACTIVE` / `CHECKED OUT`), Delete, and CSV Export.

3. **Forest Safety & Advisory Assistant**:
   - Backend API endpoint (`/api/chat`) powered by secure API keys.
   - Answers inquiries regarding forest fire risks, ambient temperatures, NDMA safety directives, and visitor rules.

4. **Environmental Risk Calculator**:
   - Sliders for Temperature, Humidity, Wind Speed, NDVI Index, Soil Moisture, and Human Activity.
   - Calculates real-time flammability score percentages and highlights critical environmental factors.

5. **Vercel Serverless & Local Flask Ready**:
   - Modular Flask architecture (`api/index.py`, `templates/`, `static/`).
   - Configured with `vercel.json` for one-click deployment on Vercel.

---

## 🚀 Quick Start / How to Run Locally

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Application
```bash
python api/index.py
```
The portal will be active locally at: 👉 **`http://127.0.0.1:5000`**

---

## ☁️ Deploying to Vercel

Open deployed project in website 
```bash
https://wildfire-ai-intelligence-kijq97k3y-hamsavenibs04-2960s-projects.vercel.app/
```
