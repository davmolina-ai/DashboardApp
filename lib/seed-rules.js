function createGroup(operator, children, options = {}) {
  return {
    id: options.id || randomId("group"),
    type: "group",
    operator,
    not: Boolean(options.not),
    children
  };
}

function createCondition(field, comparator, value, options = {}) {
  return {
    id: options.id || randomId("condition"),
    type: "condition",
    field,
    comparator,
    value,
    not: Boolean(options.not),
    label: options.label || ""
  };
}

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function colonCancerRule() {
  return {
    slug: "colon-cancer-fit-outreach",
    name: "Colon Cancer FIT Outreach",
    description:
      "Average-risk adults age 45-75 who are overdue for colorectal cancer screening, without recent refusal, without alternative screening, and not excluded.",
    status: "Active",
    measure: "Colon cancer screening",
    profile: "colon_cancer",
    sourceType: "curated_guideline",
    sourceLabel: "USPSTF colorectal cancer screening recommendation",
    sourceUrl: "https://www.uspreventiveservicestaskforce.org/uspstf/document/RecommendationStatementFinal/colorectal-cancer-screening",
    rationale:
      "USPSTF recommends colorectal cancer screening for adults age 45 to 75. This rule proposes FIT outreach for overdue patients without exclusions or recent refusal.",
    definition: {
      version: 1,
      profile: "colon_cancer",
      root: createGroup("AND", [
        createCondition("Age", "between", [45, 75], {
          label: "Age is between 45 and 75"
        }),
        createCondition("Screened within Timeframes", "equals", "No", {
          label: "Patient is overdue for screening"
        }),
        createCondition("Other Screening Type", "blank", "", {
          label: "No alternative screening documented"
        }),
        createCondition("Excluded from Screening", "notAffirmative", "", {
          label: "Patient is not excluded"
        }),
        createCondition("History of Positive", "notAffirmative", "", {
          label: "No positive screening history"
        }),
        createGroup("OR", [
          createCondition("Screening Refusal Date", "blank", "", {
            label: "No refusal date is documented"
          }),
          createCondition("Screening Refusal Date", "olderThanDays", 365, {
            label: "Refusal is older than 1 year"
          })
        ])
      ]),
      action: {
        type: "draftOrder",
        gapReason: "Overdue colon cancer screening",
        recommendedOrder: "Fecal immunochemical test",
        orderInput: {
          code: "FIT",
          display: "Fecal immunochemical test",
          occurrenceText: "Routine within next month"
        },
        dueDateField: "Screening Due Date"
      }
    }
  };
}

function lungCancerRule() {
  return {
    slug: "lung-cancer-ldct-screening",
    name: "Lung Cancer LDCT Screening",
    description:
      "Adults age 50-80 with qualifying smoking history and no recent quit interval outside the screening window.",
    status: "Active",
    measure: "Lung cancer screening",
    profile: "lung_cancer",
    sourceType: "curated_guideline",
    sourceLabel: "USPSTF lung cancer screening recommendation",
    sourceUrl: "https://www.uspreventiveservicestaskforce.org/uspstf/document/RecommendationStatementFinal/lung-cancer-screening",
    rationale:
      "USPSTF recommends annual lung cancer screening with low-dose CT for certain adults age 50 to 80 with a 20 pack-year history who currently smoke or quit within 15 years.",
    definition: {
      version: 1,
      profile: "lung_cancer",
      root: createGroup("AND", [
        createCondition("Age", "between", [50, 80], {
          label: "Age is between 50 and 80"
        }),
        createCondition("Smoking Pack Years", "greaterThanOrEqual", 20, {
          label: "Smoking history is at least 20 pack years"
        }),
        createGroup("OR", [
          createCondition("Smoking Status", "equals", "current", {
            label: "Current smoker"
          }),
          createCondition("Years Since Quit", "lessThanOrEqual", 15, {
            label: "Quit within 15 years"
          })
        ])
      ]),
      action: {
        type: "draftOrder",
        gapReason: "Eligible for lung cancer screening",
        recommendedOrder: "Low-dose CT for lung cancer screening",
        orderInput: {
          code: "LDCT",
          display: "Low-dose CT for lung cancer screening",
          occurrenceText: "Schedule within 30 days"
        },
        dueDateField: "Due Date"
      }
    }
  };
}

function cirrhosisUltrasoundRule() {
  return {
    slug: "cirrhosis-hcc-ultrasound-surveillance",
    name: "Cirrhosis HCC Ultrasound Surveillance",
    description:
      "Patients on the cirrhosis registry with cirrhosis diagnosis who are overdue for ultrasound surveillance and have no active refusal or existing order.",
    status: "Active",
    measure: "Cirrhosis management",
    profile: "cirrhosis",
    sourceType: "curated_guideline",
    sourceLabel: "AASLD HCC surveillance guidance",
    sourceUrl: "https://www.aasld.org/liver-fellow-network/core-series/clinical-pearls/hcc-metabolic-dysfunction-associated-steatotic",
    rationale:
      "Adults with cirrhosis are commonly surveilled for hepatocellular carcinoma with liver ultrasound every 6 months, with or without AFP.",
    definition: {
      version: 1,
      profile: "cirrhosis",
      root: createGroup("AND", [
        createCondition("Diagnosis", "affirmative", "", {
          label: "Cirrhosis diagnosis is present"
        }),
        createGroup("OR", [
          createCondition("Ultrasound Screening Date", "blank", "", {
            label: "No prior ultrasound documented"
          }),
          createCondition("Ultrasound Screening Date", "olderThanDays", 180, {
            label: "Ultrasound is overdue by more than 6 months"
          })
        ]),
        createCondition("Ultrasound Screening Ordered", "notAffirmative", "", {
          label: "No active ultrasound order"
        }),
        createGroup("OR", [
          createCondition("Ultrasound Screening Refused", "blank", "", {
            label: "No refusal documented"
          }),
          createCondition("Ultrasound Screening Refused", "olderThanDays", 365, {
            label: "Refusal is older than 1 year"
          })
        ])
      ]),
      action: {
        type: "draftOrder",
        gapReason: "Overdue ultrasound surveillance for hepatocellular carcinoma",
        recommendedOrder: "Liver ultrasound for HCC surveillance",
        orderInput: {
          code: "CIRR-US",
          display: "Liver ultrasound for HCC surveillance",
          occurrenceText: "Schedule within 30 days"
        },
        dueDaysFromToday: 30
      }
    }
  };
}

function cirrhosisAfpRule() {
  return {
    slug: "cirrhosis-afp-monitoring",
    name: "Cirrhosis AFP Monitoring",
    description:
      "Patients on the cirrhosis registry who are due for AFP monitoring and do not already have a standing order or active refusal.",
    status: "Active",
    measure: "Cirrhosis management",
    profile: "cirrhosis",
    sourceType: "curated_guideline",
    sourceLabel: "AASLD HCC surveillance guidance",
    sourceUrl: "https://www.aasld.org/liver-fellow-network/core-series/clinical-pearls/hcc-metabolic-dysfunction-associated-steatotic",
    rationale:
      "AFP is commonly paired with ultrasound surveillance in cirrhosis workflows when monitoring for hepatocellular carcinoma.",
    definition: {
      version: 1,
      profile: "cirrhosis",
      root: createGroup("AND", [
        createCondition("Diagnosis", "affirmative", "", {
          label: "Cirrhosis diagnosis is present"
        }),
        createGroup("OR", [
          createCondition("AFP Date", "blank", "", {
            label: "No recent AFP date documented"
          }),
          createCondition("AFP Date", "olderThanDays", 180, {
            label: "AFP monitoring is overdue by more than 6 months"
          })
        ]),
        createCondition("AFP Ordered", "notAffirmative", "", {
          label: "No active AFP order"
        }),
        createGroup("OR", [
          createCondition("AFP Refused", "blank", "", {
            label: "No AFP refusal documented"
          }),
          createCondition("AFP Refused", "olderThanDays", 365, {
            label: "AFP refusal is older than 1 year"
          })
        ])
      ]),
      action: {
        type: "draftOrder",
        gapReason: "Overdue AFP laboratory monitoring",
        recommendedOrder: "Alpha-fetoprotein lab monitoring",
        orderInput: {
          code: "CIRR-AFP",
          display: "Alpha-fetoprotein lab monitoring",
          occurrenceText: "Collect within 30 days"
        },
        dueDaysFromToday: 30
      }
    }
  };
}

function cirrhosisVaricesRule() {
  return {
    slug: "cirrhosis-varices-screening",
    name: "Cirrhosis Varices Screening",
    description:
      "Patients with cirrhosis who are marked as requiring EGD or Fibroscan and are overdue for varices screening without an active order.",
    status: "Active",
    measure: "Cirrhosis management",
    profile: "cirrhosis",
    sourceType: "curated_guideline",
    sourceLabel: "AASLD portal hypertension and varices surveillance practice guidance",
    sourceUrl: "https://www.aasld.org/practice-guidelines/portal-hypertension-bleeding-cirrhosis",
    rationale:
      "Cirrhosis management often includes screening for varices when clinically indicated, especially when EGD or Fibroscan surveillance is flagged.",
    definition: {
      version: 1,
      profile: "cirrhosis",
      root: createGroup("AND", [
        createCondition("Diagnosis", "affirmative", "", {
          label: "Cirrhosis diagnosis is present"
        }),
        createCondition("EGD or Fibroscan Required?", "oneOf", ["EGD", "Fibroscan"], {
          label: "Varices screening modality is required"
        }),
        createGroup("OR", [
          createCondition("Varices Screened (EGD) Date", "blank", "", {
            label: "No prior varices screening date"
          }),
          createCondition("Varices Screened (EGD) Date", "olderThanDays", 365, {
            label: "Varices screening is overdue by more than 1 year"
          })
        ]),
        createCondition("Varices Screening Ordered", "notAffirmative", "", {
          label: "No active varices screening order"
        }),
        createGroup("OR", [
          createCondition("Varices Screening Refusal Date", "blank", "", {
            label: "No refusal documented"
          }),
          createCondition("Varices Screening Refusal Date", "olderThanDays", 365, {
            label: "Refusal is older than 1 year"
          })
        ])
      ]),
      action: {
        type: "draftOrder",
        gapReason: "Overdue esophageal varices screening",
        recommendedOrder: "EGD or Fibroscan for varices screening",
        orderInput: {
          code: "CIRR-EGD",
          display: "EGD or Fibroscan for varices screening",
          occurrenceText: "Arrange within 30 days"
        },
        dueDaysFromToday: 30
      }
    }
  };
}

function asthmaIcsRule() {
  return {
    slug: "asthma-controller-therapy-review",
    name: "Asthma Controller Therapy Review",
    description:
      "Patients meeting persistent asthma criteria who are missing an active inhaled corticosteroid medication.",
    status: "Draft",
    measure: "Asthma management",
    profile: "asthma",
    sourceType: "curated_guideline",
    sourceLabel: "GINA asthma strategy",
    sourceUrl: "https://ginasthma.org/2025-gina-strategy-report/",
    rationale:
      "Persistent asthma commonly warrants inhaled corticosteroid-based controller therapy. This rule flags likely care gaps when controller medication is absent.",
    definition: {
      version: 1,
      profile: "asthma",
      root: createGroup("AND", [
        createCondition("Meets Persistent Asthma Criteria", "affirmative", "", {
          label: "Persistent asthma criteria met"
        }),
        createCondition("Active ICS Medication", "blank", "", {
          label: "No active ICS medication documented"
        })
      ]),
      action: {
        type: "draftOrder",
        gapReason: "Persistent asthma without active controller therapy",
        recommendedOrder: "Inhaled corticosteroid controller medication review",
        orderInput: {
          code: "ASTHMA-ICS",
          display: "Inhaled corticosteroid controller medication",
          occurrenceText: "Review and consider initiation within 30 days"
        },
        dueDaysFromToday: 30
      }
    }
  };
}

function ascvdStatinRule() {
  return {
    slug: "ascvd-statin-initiation-review",
    name: "ASCVD Statin Initiation Review",
    description:
      "Patients with elevated 10-year ASCVD risk who have no statin documented and no statin allergy.",
    status: "Draft",
    measure: "ASCVD prevention",
    profile: "ascvd",
    sourceType: "curated_guideline",
    sourceLabel: "USPSTF statin primary prevention recommendation",
    sourceUrl: "https://www.uspreventiveservicestaskforce.org/uspstf/document/RecommendationStatementFinal/statin-use-in-adults-preventive-medication",
    rationale:
      "Primary prevention guidelines commonly consider statin therapy for adults with elevated ASCVD risk after clinician-patient discussion, especially when no statin is documented.",
    definition: {
      version: 1,
      profile: "ascvd",
      root: createGroup("AND", [
        createCondition("10-year ASCVD Risk (%)", "greaterThanOrEqual", 10, {
          label: "10-year ASCVD risk is at least 10%"
        }),
        createCondition("Statin", "blank", "", {
          label: "No statin documented"
        }),
        createCondition("Statin Allergy?", "notAffirmative", "", {
          label: "No statin allergy documented"
        })
      ]),
      action: {
        type: "draftOrder",
        gapReason: "Elevated ASCVD risk without statin therapy",
        recommendedOrder: "Statin therapy review",
        orderInput: {
          code: "ASCVD-STATIN",
          display: "Statin therapy review",
          occurrenceText: "Review within 30 days"
        },
        dueDaysFromToday: 30
      }
    }
  };
}

function getSeedRules() {
  return [
    colonCancerRule(),
    lungCancerRule(),
    cirrhosisUltrasoundRule(),
    cirrhosisAfpRule(),
    cirrhosisVaricesRule(),
    asthmaIcsRule(),
    ascvdStatinRule()
  ];
}

function detectClinicalProfile(headers) {
  const headerSet = new Set(headers.map((header) => header.toLowerCase()));

  if (
    headerSet.has("screened within timeframes") &&
    headerSet.has("screening due date") &&
    headerSet.has("screening refusal date")
  ) {
    return "colon_cancer";
  }

  if (
    headerSet.has("ultrasound screening date") &&
    headerSet.has("afp date") &&
    headerSet.has("egd or fibroscan required?")
  ) {
    return "cirrhosis";
  }

  if (
    headerSet.has("meets persistent asthma criteria") &&
    headerSet.has("active ics medication")
  ) {
    return "asthma";
  }

  if (
    headerSet.has("10-year ascvd risk (%)") &&
    headerSet.has("statin")
  ) {
    return "ascvd";
  }

  if (
    hasAny(headerSet, ["a1c", "hba1c", "hemoglobin a1c", "albumin creatinine ratio", "retinal exam", "diabetes diagnosis"]) ||
    (hasAny(headerSet, ["diabetes", "prediabetes"]) && hasAny(headerSet, ["a1c due date", "microalbumin", "eye exam"]))
  ) {
    return "diabetes";
  }

  if (
    hasAny(headerSet, ["vaccine", "influenza vaccine", "covid-19 vaccine", "pneumococcal vaccine", "shingles vaccine"]) ||
    (hasAny(headerSet, ["immunization status", "last vaccine date"]) && hasAny(headerSet, ["age", "care team"]))
  ) {
    return "immunizations";
  }

  if (
    hasAny(headerSet, ["egfr", "uacr", "albumin creatinine ratio", "ckd stage", "nephrology referral", "creatinine"]) ||
    (hasAny(headerSet, ["chronic kidney disease", "kidney disease"]) && hasAny(headerSet, ["care team", "due date"]))
  ) {
    return "ckd";
  }

  if (
    hasAny(headerSet, ["copd", "fev1", "spirometry", "laba", "lama", "exacerbation count"]) ||
    (hasAny(headerSet, ["smoking status", "copd diagnosis"]) && hasAny(headerSet, ["care team", "inhaler"]))
  ) {
    return "copd";
  }

  if (
    hasAny(headerSet, ["pap test", "hpv test", "cervical screening", "last pap date", "last hpv date"]) ||
    (hasAny(headerSet, ["pap due date", "hpv due date"]) && hasAny(headerSet, ["age", "care team"]))
  ) {
    return "cervical_cancer";
  }

  if (
    hasAny(headerSet, ["ejection fraction", "heart failure diagnosis", "ace inhibitor", "arb", "arni", "beta blocker hf"]) ||
    (hasAny(headerSet, ["heart failure", "ef"]) && hasAny(headerSet, ["care team", "medication"]))
  ) {
    return "heart_failure";
  }

  if (
    hasAny(headerSet, ["hbsag", "hbv dna", "alt", "hepatitis b diagnosis", "hepatitis b viral load"]) ||
    (hasAny(headerSet, ["hepatitis b", "hcc surveillance"]) && hasAny(headerSet, ["care team", "due date"]))
  ) {
    return "hepatitis_b";
  }

  if (
    headerSet.has("smoking status") &&
    (headerSet.has("smoking pack years") || headerSet.has("pack years"))
  ) {
    return "lung_cancer";
  }

  return "generic";
}

function hasAny(headerSet, candidates) {
  return candidates.some((candidate) => headerSet.has(candidate));
}

function getRuleSuggestions(profile) {
  return getSeedRules().filter((rule) => rule.profile === profile);
}

module.exports = {
  detectClinicalProfile,
  getRuleSuggestions,
  getSeedRules
};
