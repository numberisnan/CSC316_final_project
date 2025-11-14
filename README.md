# Balancing the Student Life — CSC316 Final Project (Prototype V2)

**Course:** CSC316 — Data Visualization  
**Week 9 Submission:** Prototype V2  
**Team:** *Stressly*  
**Members:**  
- Cynthia Liu — Visualization Lead  
- Ayaan Asif — Front-End & Integration Lead  
- Tahseen Rana — Data Lead  
- Faraz Malik — Quality & Documentation Lead 

**Public Instances:**
- [https://farazkaleemmalik.cyou/CSC316_final_project/](https://farazkaleemmalik.cyou/CSC316_final_project/)
---

## 📘 Project Overview
**Theme:** *Stress, Sleep, and Lifestyle Habits: Understanding Student Well-Being*  
This interactive prototype explores how stress relates to emotional well-being, coping strategies, and lifestyle choices among university students. It visualizes survey data (from Kaggle and Figshare) covering stress (PSS-10), anxiety (GAD-7), depression (PHQ-9), sleep, exercise, and coping mechanisms.

The visualization aims to make complex mental-health correlations accessible, allowing users to explore relationships interactively rather than through static graphs.

---

## 🧩 Visualizations Implemented

### 1. 🔺 Emotion Constellation Triangle *(Novel Design)*
**File:** `ternary.js`  
A ternary plot mapping each student’s normalized **Stress (PSS-10)**, **Anxiety (GAD-7)**, and **Depression (PHQ-9)** scores within a triangular coordinate space.
- **Color** encodes combined emotional severity (yellow = high, purple = low).
- **Position** shows each student’s emotional balance.
- **Interaction:** hover tooltips and toggles for heatmap view.
- **Planned:** lasso selection linking subsets to the Coping Garden.
- **Insight:** clear co-movement of stress, anxiety, and depression indicates emotional clustering.

---

### 2. 🌼 Coping Strategy Garden
**File:** `garden.js`  
A botanical metaphor visualizing stress outcomes by coping behavior.
- Each **flower** represents one coping strategy.
- **Stem height** → lower average stress = taller flower.
- **Petal color** → frequency of students using that strategy.
- **Flower size** → average exercise hours.
- **Interactive features:** hover tooltips, click to pin average stress values.
- **Planned:** filters for major/year and linked highlighting from the triangle view.
- **Insight:** healthy, active habits (exercise, socializing) grow tall and bright; passive ones stay short and muted.

---

### 3. 🌙 Sleep Orbit Map — Slider Prototype
**File:** `sleep_orbit.js`  
A circular, time-based visualization exploring the relationship between **sleep timing** and **stress**.
- Users adjust three sliders: **in bed**, **asleep**, and **wake**.
- The **arc length** represents total sleep duration.
- A **floating chip** displays a predicted stress score (lower = better).
- **Design origin:** inspired by a hand-drawn sketch prototype.
- **Insight:** optimal stress levels cluster around 7–8 hours of sleep near midnight.

#### Updates for V2

- Add sliders/interactivity
- Connect vis to data
- Add icons, transitions
- Incorperate global filter

---

### 4. 🧍‍♀️ Stick Figure Map with RadarMaps
**File:** `radar_avatars.js`  
An animated environment where each student is represented as a **stick-figure avatar** tied to their wellness profile.
- Figures **roam** until a metric (e.g., sleep, exercise, severity) is selected.
- On selection, figures **cluster dynamically** based on that variable.
- Hovering reveals a **radar (spider) chart** showing:
    - Stress
    - Sleep
    - Exercise
    - Depression
    - Anxiety
- ***Improvements based on TA feedback:** added a scrolling feature which spreads out the stick figures after they are sorted based on metric to easily hover over each without overlapping. Made the head sizes larger and implemented the colour depending on stress severity. Also added left and right columns if the stick figures overflow*
- **Insight:** humanizes data — students are no longer points, but individuals with multidimensional traits. The radar maps show an individual's well being level with the groupings helping the user understand how their peers are faring.

---

### 5. 🧑‍🏫 Classroom of Stress
**File:** `classroom.js`  
A pictograph layout representing students across **16 different majors**, colored by stress level.
- Each stick figure = one major.
- **Color legend:**
    - Light Blue → Low Stress
    - Orange → Moderate Stress
    - Red → High Stress
- Hover tooltips reveal demographic info (major, year, average stress).
- **Insight:** stress distribution is **widespread and cross-disciplinary**, not isolated to any one field.

**V2** : I foucsed on connecting the dataset to the visualization, filter behaviour, and user interactive across the visualization. The main updates centered on correctly generating derived student data, fixing tooltip logic, implementing proper filtering for major and gender, and ensuring selection/highlighting works smoothly. Originally, in v1, I had implemented the visualization to output random data but now it follows the dataset correctly and uses the filters to output correct data to users.
---

## 🧮 Data

**File:** `cleaned_data.csv`  
Merged and cleaned from multiple public datasets on Kaggle/Figshare:  
- *Student Mental Health and Coping Mechanisms*  
- *MHP Anxiety–Stress–Depression Dataset (Bangladesh)*  
- *Student Stress Monitoring Dataset*  

Main columns retained:
| Variable | Description |
|-----------|-------------|
| `stress_score` | PSS-10 total stress score (0–40) |
| `anxiety_score` | GAD-7 anxiety score (0–21) |
| `depression_score` | PHQ-9 depression score (0–27) |
| `sleep_hours` | Average hours of sleep per night |
| `exercise_hours` | Hours of exercise per week |
| `coping_strategy` | Reported coping mechanism |
| `major`, `gender`, `year` | Demographic info |

Outliers (e.g., age > 90) were removed, and missing stress values were dropped.  
All numeric columns were normalized for the triangle view.

---

## 🎛️ Interaction & Controls

**Implemented**
- Dropdown filters for `Year`, `Major`, and `Gender`.  
- Dynamic re-rendering of both views with filtered data.  
- Linked highlighting between the triangle and garden.  
- Tooltip hover details and guided narrative overlays.

**Planned**
- Lasso selection within the triangle to highlight subsets in the garden.  
- Stress simulator predicting scores from sleep, exercise, and coping choices.

---

## 💻 File Structure
```
css/
 └── style.css
 data/
 └── cleaned_data.csv
js/
 ├── classroom.js
 ├── garden.js
 ├── main.js
 ├── radar_avatars.js
 ├── sleep-orbit.js
 ├── ternary.js
 └── utils.js
font/...
index.html
README.md
```

---

## ⚙️ Setup & Run
1. Place all files in one folder (or deploy to GitHub Pages).  
2. Ensure the CSV is in `/data/cleaned_data.csv`.  
3. Open `index.html` in a browser.  
4. Requires internet access to load D3 v7 from CDN.

---

## 🧠 Storytelling Structure
- **Hook — “The Student Spiral”**  
  “Every student knows the pattern — less sleep, more caffeine, higher stress.”
- **Rising Insights**  
  Data reveals clustering among stress, anxiety, and depression.
- **Main Message**  
  Coping strategies involving activity (exercise, socializing) correlate with lower stress.
- **Solution**  
  Encourages balance — improving mental health through sustainable habits.

---

## ✨ Credits
Built with [D3.js v7](https://d3js.org/).  
Design concept and visuals by *Team Stressly (UofT CSC316, Fall 2025)*.  
Dataset sources: Kaggle, Figshare.  
© 2025 University of Toronto — For academic use only.
