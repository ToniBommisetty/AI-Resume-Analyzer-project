from flask import Flask, render_template, request, redirect, url_for, session
import PyPDF2
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from skills_db import skills_list

app = Flask(__name__)
app.secret_key = "secret123"

nlp = spacy.load("en_core_web_sm")

# Dummy login credentials
USER_EMAIL = "user@gmail.com"
USER_PASSWORD = "123456"


# ---------- Resume Functions ----------

def extract_text_from_pdf(file):
    reader = PyPDF2.PdfReader(file)
    text = ""
    for page in reader.pages:
        text += page.extract_text()
    return text


def extract_skills(text):
    text = text.lower()
    found_skills = []

    for skill in skills_list:
        if skill in text:
            found_skills.append(skill)

    return list(set(found_skills))


def extract_text_from_pdf(file):
    reader = PyPDF2.PdfReader(file)
    text = ""
    for page in reader.pages:
        if page.extract_text():
            text += page.extract_text()
    return text

def calculate_similarity(resume, job):
    vectorizer = TfidfVectorizer()
    vectors = vectorizer.fit_transform([resume, job])
    similarity = cosine_similarity(vectors[0], vectors[1])
    return round(similarity[0][0] * 100, 2)


# ---------- ROUTES ----------

@app.route("/")
def welcome():
    return render_template("welcome.html")


@app.route("/login", methods=["GET","POST"])
def login():

    if request.method == "POST":

        email = request.form["email"]
        password = request.form["password"]

        if email == USER_EMAIL and password == USER_PASSWORD:

            session["user"] = email

            return redirect("/analyzer")

        else:
            return render_template("login.html", error="Invalid Email or Password")

    return render_template("login.html")


@app.route("/analyzer", methods=["GET","POST"])
def analyzer():

    if "user" not in session:
        return redirect("/login")

    score = None
    matched_skills = []
    missing_skills = []
    suggestions = []
    resume_format = ""

    if request.method == "POST":

        job_description = request.form["job_description"]
        resume_file = request.files["resume"]

        resume_text = extract_text_from_pdf(resume_file)

        resume_skills = extract_skills(resume_text)
        job_skills = extract_skills(job_description)

        matched_skills = list(set(resume_skills) & set(job_skills))
        missing_skills = list(set(job_skills) - set(resume_skills))

        skill_score = (len(matched_skills)/len(job_skills))*100 if job_skills else 0
        similarity_score = calculate_similarity(resume_text, job_description)

        score = round((skill_score*0.6)+(similarity_score*0.4),2)

    return render_template(
        "index.html",
        score=score,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        suggestions=suggestions,
        resume_format=resume_format
    )


@app.route("/logout")
def logout():
    session.pop("user",None)
    return redirect(url_for("welcome"))


if __name__ == "__main__":
    app.run(debug=True)