const GUIDELINE_SOURCES = [
  {
    sourceKey: "uspstf-colorectal-cancer-screening",
    domain: "colon_cancer",
    authority: "USPSTF",
    title: "Colorectal Cancer: Screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/document/RecommendationStatementFinal/colorectal-cancer-screening",
    summary:
      "Official colorectal cancer screening recommendation for average-risk adults, including stool-based testing and direct visualization strategies.",
    keyPoints: [
      "Average-risk adults age 45 to 75 should be screened.",
      "FIT and other stool-based tests are standard options.",
      "Rules should account for exclusions, prior screening, and refusal history when that data exists."
    ],
    status: "Active"
  },
  {
    sourceKey: "uspstf-lung-cancer-screening",
    domain: "lung_cancer",
    authority: "USPSTF",
    title: "Lung Cancer: Screening",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/document/RecommendationStatementFinal/lung-cancer-screening",
    summary:
      "Official lung cancer screening recommendation focused on annual low-dose CT for qualifying adults.",
    keyPoints: [
      "Typical screening age band is 50 to 80.",
      "Pack-year and quit-interval fields are key signals.",
      "Rules should remain conservative when smoking history is incomplete."
    ],
    status: "Active"
  },
  {
    sourceKey: "uspstf-statin-primary-prevention",
    domain: "ascvd",
    authority: "USPSTF",
    title: "Statin Use for the Primary Prevention of Cardiovascular Disease in Adults",
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/document/RecommendationStatementFinal/statin-use-in-adults-preventive-medication",
    summary:
      "Primary prevention recommendation addressing statin use in adults with elevated cardiovascular risk and appropriate risk-factor context.",
    keyPoints: [
      "Elevated risk should be paired with clinician review.",
      "Absence of current statin therapy and contraindications are common gap signals.",
      "Suggested rules should propose review, not automatic treatment."
    ],
    status: "Active"
  },
  {
    sourceKey: "acc-aha-lipids-cholesterol-2026",
    domain: "ascvd",
    authority: "ACC/AHA",
    title: "ACC/AHA Guideline for Managing Lipids and Cholesterol",
    url: "https://www.acc.org/about-acc/press-releases/2026/03/13/18/01/accaha-issue-updated-guideline-for-managing-lipids-cholesterol",
    summary:
      "Updated joint guideline for lipid management and dyslipidemia care that complements prevention-focused ASCVD workflows.",
    keyPoints: [
      "Lifestyle optimization remains foundational.",
      "Higher-risk adults may need earlier medication consideration.",
      "Rules should support shared decision-making workflows."
    ],
    status: "Active"
  },
  {
    sourceKey: "gina-2025-asthma-strategy",
    domain: "asthma",
    authority: "GINA",
    title: "Global Strategy for Asthma Management and Prevention (2025)",
    url: "https://ginasthma.org/2025-gina-strategy-report/",
    summary:
      "Current asthma management strategy report used widely for controller therapy and care escalation recommendations.",
    keyPoints: [
      "Persistent asthma generally warrants controller-based management.",
      "Absence of active ICS therapy may represent a care gap when structured criteria are met.",
      "Rules should remain conservative when symptom burden is not fully represented in the CSV."
    ],
    status: "Active"
  },
  {
    sourceKey: "aasld-portal-hypertension-varices",
    domain: "cirrhosis",
    authority: "AASLD",
    title: "Portal Hypertension Bleeding in Cirrhosis",
    url: "https://www.aasld.org/practice-guidelines/portal-hypertension-bleeding-cirrhosis",
    summary:
      "AASLD practice guidance covering portal hypertension risk stratification and varices-related surveillance in cirrhosis.",
    keyPoints: [
      "Orders and recent refusals should suppress duplicate draft recommendations.",
      "EGD and Fibroscan modality flags are meaningful structured signals.",
      "Varices surveillance is a common cirrhosis dashboard use case."
    ],
    status: "Active"
  },
  {
    sourceKey: "aasld-practice-guidelines-overview",
    domain: "cirrhosis",
    authority: "AASLD",
    title: "AASLD Practice Guidelines",
    url: "https://www.aasld.org/practice-guidelines",
    summary:
      "Index of evidence-based AASLD practice guidance across liver disease topics, useful for cirrhosis-related surveillance and management workflows.",
    keyPoints: [
      "AASLD guidance is updated on a recurring basis.",
      "Cirrhosis care gaps often involve HCC surveillance, portal hypertension monitoring, and decompensation management.",
      "Rules should reference specific surveillance logic when possible."
    ],
    status: "Active"
  },
  {
    sourceKey: "aasld-ascites-sbp-hrs",
    domain: "cirrhosis",
    authority: "AASLD",
    title: "Diagnosis, Evaluation and Management of Ascites, Spontaneous Bacterial Peritonitis and Hepatorenal Syndrome",
    url: "https://www.aasld.org/practice-guidelines/diagnosis-evaluation-and-management-ascites-spontaneous-bacterial-peritonitis",
    summary:
      "AASLD practice guidance relevant to advanced cirrhosis management beyond surveillance-only use cases.",
    keyPoints: [
      "Useful for future cirrhosis management workflows beyond HCC and varices screening.",
      "Rules should be tied tightly to available structured indicators.",
      "Registry-style dashboards can support referral and monitoring logic."
    ],
    status: "Active"
  },
  {
    sourceKey: "ada-standards-of-care-2026",
    domain: "diabetes",
    authority: "ADA",
    title: "Standards of Care in Diabetes 2026",
    url: "https://professional.diabetes.org/standards-of-care/practice-guidelines-resources",
    summary:
      "The ADA Standards of Care are the primary evidence-based guideline set for diabetes and prediabetes screening, monitoring, and chronic disease management.",
    keyPoints: [
      "Common dashboard opportunities include A1c monitoring, kidney screening, eye exams, and medication review.",
      "Rules should preserve clinician review for treatment changes.",
      "Structured diabetes dashboards often map well to quality gap logic."
    ],
    status: "Active"
  },
  {
    sourceKey: "cdc-adult-immunization-schedules",
    domain: "immunizations",
    authority: "CDC",
    title: "Healthcare Professionals: Immunization Schedules",
    url: "https://www.cdc.gov/vaccines/hcp/imz-schedules/index.html",
    summary:
      "Official CDC immunization schedule hub for adult and pediatric vaccination recommendations used in population health and preventive care workflows.",
    keyPoints: [
      "Age and medical condition are the core structured inputs.",
      "Immunization dashboards are a strong fit for CSV-driven gap detection.",
      "Rules should distinguish between missing history and true due status when possible."
    ],
    status: "Active"
  },
  {
    sourceKey: "cdc-adult-immunization-medical-condition",
    domain: "immunizations",
    authority: "CDC",
    title: "Adult Immunization Schedule by Medical Condition and Other Indication",
    url: "https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-medical-condition.html",
    summary:
      "Condition-based adult immunization schedule table used for more targeted vaccine recommendation logic.",
    keyPoints: [
      "Medical-condition-driven vaccine rules can be encoded when condition data is present.",
      "Condition-based schedules are more precise than age-only logic.",
      "Rules should handle missing vaccine history conservatively."
    ],
    status: "Active"
  },
  {
    sourceKey: "kdigo-ckd-guidelines",
    domain: "ckd",
    authority: "KDIGO",
    title: "KDIGO Clinical Practice Guidelines",
    url: "https://kdigo.org/guidelines/",
    summary:
      "KDIGO guideline collection for chronic kidney disease evaluation, staging, and longitudinal management.",
    keyPoints: [
      "CKD dashboards often include eGFR, albuminuria, and referral or monitoring gaps.",
      "Lab-driven thresholds are a strong fit for draft rule logic.",
      "Rules should avoid overcommitting when staging inputs are incomplete."
    ],
    status: "Active"
  },
  {
    sourceKey: "gold-copd-reports",
    domain: "copd",
    authority: "GOLD",
    title: "Global Initiative for Chronic Obstructive Lung Disease Reports",
    url: "https://goldcopd.org/",
    summary:
      "GOLD reports provide internationally recognized COPD management guidance useful for inhaler review, exacerbation follow-up, and preventive care workflows.",
    keyPoints: [
      "COPD dashboards often support inhaler review and vaccination outreach.",
      "Exacerbation and spirometry history are important structured signals.",
      "Rules should be framed as draft review when disease-severity context is sparse."
    ],
    status: "Active"
  },
  {
    sourceKey: "acog-cervical-cancer-screening-2026",
    domain: "cervical_cancer",
    authority: "ACOG",
    title: "ACOG Updated Cervical Cancer Screening Guidance",
    url: "https://www.acog.org/news/news-releases/2026/04/acog-publishes-updated-cervical-cancer-screening-guidance",
    summary:
      "Updated cervical cancer screening guidance aligned with evidence-based preventive care recommendations.",
    keyPoints: [
      "Age bands and test interval logic are central to cervical screening workflows.",
      "Patient-collected hrHPV workflows may matter where documented infrastructure exists.",
      "Rules should use available screening-history fields conservatively."
    ],
    status: "Active"
  },
  {
    sourceKey: "acog-cervical-cancer-screening-faq",
    domain: "cervical_cancer",
    authority: "ACOG",
    title: "Cervical Cancer Screening",
    url: "https://www.acog.org/womens-health/faqs/cervical-cancer-screening",
    summary:
      "Practical cervical cancer screening guidance with age-band screening options and screening-history considerations.",
    keyPoints: [
      "Pap, HPV, and co-testing intervals vary by age.",
      "Older-age exclusion logic may depend on prior negative history.",
      "Draft rules should reflect documented modality and due interval fields."
    ],
    status: "Active"
  },
  {
    sourceKey: "acc-aha-heart-failure-guidelines",
    domain: "heart_failure",
    authority: "ACC/AHA",
    title: "ACC/AHA Heart Failure Guidance Collection",
    url: "https://www.acc.org/guidelines",
    summary:
      "ACC/AHA heart failure guideline family relevant to diagnosis-based management dashboards and medication review workflows.",
    keyPoints: [
      "Heart failure dashboards often require diagnosis, EF, symptoms, and medication context.",
      "Initial LLM suggestions should remain conservative in this domain.",
      "Rules should focus on review prompts when disease-severity detail is incomplete."
    ],
    status: "Active"
  },
  {
    sourceKey: "aasld-hepatitis-b-guidance",
    domain: "hepatitis_b",
    authority: "AASLD",
    title: "Hepatitis B",
    url: "https://www.aasld.org/practice-guidelines/hepatitis-b",
    summary:
      "AASLD guidance collection for chronic hepatitis B management and implementation support.",
    keyPoints: [
      "Useful for follow-up, surveillance, and treatment review dashboards.",
      "HBV workflows often involve lab surveillance and imaging context.",
      "Rules should stay tied to structured registry fields and clinician review."
    ],
    status: "Active"
  }
];

function getSeedGuidelineSources() {
  return GUIDELINE_SOURCES;
}

module.exports = {
  getSeedGuidelineSources
};
