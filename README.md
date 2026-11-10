# 🤖 AI Resume Analyzer

An NLP-powered web app that compares a resume with a job description and scores how well they match. Upload a PDF resume and paste a job description, and it shows a **match score**, the **skills you have**, and the **skills you're missing**.

![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?logo=flask&logoColor=white)
![spaCy](https://img.shields.io/badge/spaCy-09A3D5?logo=spacy&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?logo=scikitlearn&logoColor=white)

## ✨ How It Works

1. **PDF parsing:** PyPDF2 extracts text from the uploaded resume.
2. **Skill extraction:** text is checked against a curated skills database (`skills_db.py`).
3. **Semantic similarity:** **TF-IDF vectorisation + cosine similarity** (scikit-learn) measures how close the resume is to the job description overall.
4. **Weighted score:** `60% skill match + 40% text similarity`, giving a final score out of 100.
5. **Gap analysis:** lists matched and missing skills so the candidate knows what to add.

## 🚀 Getting Started

```bash
git clone https://github.com/ToniBommisetty/AI-Resume-Analyzer-project.git
cd AI-Resume-Analyzer-project
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python app.py            # http://localhost:5000
```

Demo login: `user@gmail.com` / `123456`

## 📁 Other Projects in This Repo

| Folder | Project | Stack |
|---|---|---|
| `src/bank/management/system/` | **Bank Management System**: ATM-style desktop app with sign-up, PIN login, deposit, withdrawal, fast cash, balance enquiry and mini statement | Java, Swing, JDBC, MySQL |
| `uk-wholesale-comfort-theme/` | **UK Wholesale Store**: B2B wholesale shop with live product search, cart, orders, and an admin dashboard for products, categories, banners and image uploads | Node.js, Express, EJS, SQLite, Multer, Jenkins |

## 👤 Author

**Sai Narasimha Bommisetty**, Full Stack Developer · [GitHub](https://github.com/ToniBommisetty)
