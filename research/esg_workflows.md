# ESG / Sustainability Consulting Workflows: Indonesia Market Deep-Research

> Research date: 25 June 2026
> Scope: PwC Indonesia, EY Climate Change and Sustainability Services (CCSS) Indonesia, Deloitte Sustainability Indonesia, ERM Indonesia
> Focus area: data collection, framework mapping (GRI, IFRS S1/S2, SEOJK, IDX), reporting, assurance, AI workflow, tool landscape, efficiency metrics, business model.

---

## 1. Traditional Workflow by Firm
Traditional ESG consulting engagements in Indonesia typically follow a **five to six phase** linear waterfall model.

### 1.1 PwC Indonesia

| Phase | Description |
|-------|-------------|
| 1. Discovery and Scoping | Materiality assessment, stakeholder interviews, regulatory alignment check (POJK 51/2017, SEOJK 16/2021), current-state ESG inventory. |
| 2. Data Collection | Manual surveys, paper-driven site reporting, Excel spreadsheets, interviews with EHS/HR/finance teams. |
| 3. Framework Mapping | Analysts map data to GRI 2021, POJK 51/2017, SEOJK 16/2021, SASB and IFRS S1/S2; gap analysis documented in Word. |
| 4. Report Drafting | Draft prepared in MS Word or PowerPoint; heavy manual narrative writing and red-lining. |
| 5. QC and Assurance Prep | Partner/Director review, quality checks, assurance planning with limited automated validation. |
| 6. External Assurance | Limited-assurance procedures with KAP sign-off on KPIs; standalone assurance report after engagement. |

### 1.2 EY Climate Change and Sustainability Services — Indonesia

| Phase | Description |
|-------|-------------|
| 1. ESG Maturity + Gap Assessment | EY ESG Maturity Model / EY ESG Suite modules (Initiation, Maturity, Materiality, Gap assessment, Improvement). |
| 2. Regulatory Scoping | Review against POJK, SEOJK, IDX, GRI, IFRS S1/S2, SASB, TCFD; disclosure list agreed. |
| 3. Data Collection | Vendor surveys, EHS extraction, finance/HR consolidation; IBM Envizi or ERP connectors in larger engagements. |
| 4. Data Transformation | Aggregated data used to populate KPI tables (GHG Scope 1/2/3, energy, water, waste, diversity, turnover) with manual Excel calc. |
| 5. Reporting and Disclosure | Specialist decks; disclosures aligned to SEOJK / GRI 2021 / IFRS S1/S2. |
| 6. Assurance | Independent procedures per ISAE 3000; limited or moderate assurance statement issued. |

**Distinctive features:** Productized "ESG Suite" plus EY.ai for GenAI-assisted disclosures and IBM Envizi back-end.

### 1.3 Deloitte Sustainability — Indonesia

| Phase | Description |
|-------|-------------|
| 1. Materiality and Regulatory Mapping | Double materiality assessment mapped to ESRS / GRI / IFRS S1/S2 baseline. |
| 2. Baseline and Gap Assessment | Existing disclosures versus targets; data-gap identification with workplan. |
| 3. Data Collection | Spreadsheet extraction, site visits, EHS dumps; Oracle/SAP ERP feeds in some engagements. |
| 4. Metric Calculation | GHG Protocol, PCAF (financial sector), turnover calculations, peer benchmarking. |
| 5. Reporting | Multi-format output (integrated report, standalone Sustainability Report, IDX ESG Rating pack). |
| 6. Assurance and Continuous Improvement | Third-party assurance with data trails and controls documentation prepared by Deloitte. |

**Distinctive features:** Deloitte Indonesia Perspectives (Dec 2024 ESG, Dec 2025 AI editions) show strong institutional commitment. Converge(tm) unifying AI + ESG + audit-ready reporting.

### 1.4 ERM Indonesia

| Phase | Description |
|-------|-------------|
| 1. Issue Identification and Regulation Radar | ERM Global Regulations Radar maps ESG/EHS regulatory updates locally and globally. |
| 2. Data Collection | Expert-led EHS audits, environmental due diligence (oil/gas, mining, manufacturing), satellite imagery, emission factors, survey engagement. |
| 3. Impact/Risk Assessment and Mapping | Mapping to GRI, IFC PS, ILO, IDX, climate risk assessments, local PSPK 1 / PSPK 2. |
| 4. Strategy and Roadmap | Decarbonisation pathways, just transition plans, biodiversity assessments, social management plans. |
| 5. Implementation Monitoring | Annual monitoring of ESG KPIs and qualitative social/EHS data. |
| 6. Assurance and Attestation | Third-party assurance per ISAE 3000; often performed in conjunction with a separate auditor. |

**Distinctive features:** Premier environmental-social consultancy for natural-resource sector; human-led, deep site context rather than off-the-shelf engagements.

---

## 2. AI Workflow by Firm

### 2.1 PwC Indonesia

| Stage | AI Application | Tools |
|-------|----------------|-------|
| Data Ingestion | ERP/IoT/HRIS/freight/utility connectors with OCR / RAG pipelines | PwC ESG suite (cloud), SAP BTP, Salesforce NZC, custom Python scripts |
| Automated Mapping | AI drafts disclosures across GRI, POJK, IFRS S1/S2, SASB; auto-assigns material topics | PwC ESG Reporting Tool, PwC One, PwC CSRD.AI (SAP-based) |
| Monitoring / Dashboards | Real-time ESG dashboards, anomaly detection, predictive analytics | PowerBI, Tableau via SAP integration |
| Assurance / Validation | AI flags exceptions, risk-based audit sampling | PwC Transparency Report emphasis on responsible AI use |

### 2.2 EY Indonesia

| Stage | AI Application | Tools |
|-------|----------------|-------|
| Data Ingestion | ESG data source integration; IBM Envizi attribute-discovery | EY.ai, IBM Envizi, SAP Sustainability Control Tower connectors |
| Automated Mapping | GenAI-powered ESG report creation ensuring accuracy/regulatory adherence; NLP crosswalks for GRI/IFRS S1/S2/SASB/TCFD/SEOJK | EY.ai + EY ESG Suite, GenAI assistants for gap assessment |
| Monitoring / Dashboards | ESG maturity tracking, regulatory monitoring, data quality scoring | EY.ai maturity dashboards, IBM Envizi analytics |
| Assurance / Validation | Data traceability, sample selection, anomaly detection | ESRS/IFRS mapping accelerators, internal AI validation tools |

### 2.3 Deloitte Indonesia

| Stage | AI Application | Tools |
|-------|----------------|-------|
| Data Ingestion | ERP, financial, IoT, logistics, ESG software feeds | Converge(tm) by Deloitte for Sustainability |
| Automated Mapping | Workiva accelerators for ESRS/GRI/IFRS S1/S2; CSRD gap automation | Workiva (ESG Master Data Conversion Table, ESRS Mapping Accelerator, workflow tracker) |
| Monitoring / Dashboards | Real-time ESG dashboards with physical/transition risk (geospatial + AI) | Converge(tm) analytics stack + geospatial/AI modeling |
| Assurance / Validation | Automated workflow trackers maintaining audit logs and evidence | Workiva assurance evidence tracker |

### 2.4 ERM Indonesia

| Stage | AI Application | Tools |
|-------|----------------|-------|
| Data Ingestion | Web crawlers, third-party APIs, OSINT, satellite imagery | ESG Fusion (SmartFetch AI/NLP), osapiens, Auquan AI agents |
| Automated Mapping | NLP-driven disclosure extraction; AI-driven ratings across GRI, TCFD, SASB, IFC PS, IDX | ESG Fusion AI engine + Azure ML + ERM subject-matter overlay |
| Monitoring / Dashboards | ESG Fusion (2-day turnaround), emissions.AI, osapiens cockpit | ESG Fusion (ratings), emissions.AI (decarbonisation), osapiens Veeva cockpit |
| Assurance / Validation | ML audit trails for ESRS / GRI mapping; human-in-the-loop validation | ESG Fusion expert-reviewed methodology |

---

## 3. Tool Landscape

### 3.1 Workiva
End-to-end ESG reporting platform with multi-framework mapping (GRI, IFRS S1/S2, ESRS, SASB, SEOJK) via IFRS Explorer; automating data collection, validation and disclosure drafting. Deloitte Workiva accelerators used for ESRS and PCAF GHG calculations.

### 3.2 SAP Sustainability Control Tower
Centralizes ESG KPIs from SAP S/4HANA, non-SAP ERPs, IoT, and utilities; prebuilt templates for emissions, energy, water, waste. AI-assisted drafting and in-app editing reduce manual intervention.

### 3.3 ERM Digital
Proprietary AI/NLP stack including ESG Fusion (Azure ML-backed ratings), emissions.AI (plant optimisation), and osapiens (SaaS ESG cockpit). Global Regulations Radar keeps Indonesian clients current on POJK/SEOJK updates.

### 3.4 PwC ESG Suite
Cloud-based ESG Reporting Tool (real-time data and benchmarking); CSRD.AI Manager (SAP-embedded, auto-populates ESRS disclosures); PwC One AI assistant for assurance-ready reporting workflows.

---

## 4. Indicative Efficiency Metrics and Business Model (Hours vs. Subscription / Retainer)

> Note: Exact fees are proprietary; figures synthesised from industry benchmarking and PwC Global Sustainability Reporting Survey 2025.

### 4.1 Traditional Models

| Engagement | Indicative Hours | Indicative Fee |
|--------------------------------------|------------------|--------------------------------|
| Standalone Sustainability Report (POJK/SE OJK 16/2021 compliance) | 250-500 hrs (manager level) | Fixed-fee project IDR 300M-800M / USD 150-250/hr |
| EHS/ESG Due Diligence (ERM) | 400-700 hrs (expert-led) | Fixed-fee or capped retainer |
| ESG Assurance per ISAE 3000 (Big 4) | 80-150 hrs | Engagement fee via KAP |
| Post-screening ESG strategy | 150-400 hrs | Retainer or milestone |

### 4.2 AI-Uplifted Models

| Firm | AI-Assisted Time Saving | Phases Affected | Expected Billing Shift |
|------|------------------------|-----------------|------------------------|
| PwC Indonesia | 30-40 percent reduction | Data collection, validation, drafting, assurance prep | Retainer + recurring platform subscription |
| EY Indonesia | 25-35 percent reduction | Gap assessment, mapping, reporting | Subscription (Envizi + EY.ai add-on) + T&M |
| Deloitte Indonesia | 20-40 percent reduction | Data collection, ESRS mapping, assurance tracking | Fixed-fee project + platform licensing (Workiva/Converge) |
| ERM Indonesia | 15-25 percent reduction | ESG screening, monitoring, rating updates | SaaS subscription + advisory retainers |

### 4.3 Recurring Revenue Models

| Model | Price Range (USD) | Typical Buyers |
|--------------------------------------|--------------------------|--------------------------------|
| Monthly ESG Advisory Retainer | 1,500-5,000+ / month | Listed issuers, SMEs |
| Annual Platform Subscription | 10k-50k+ (SME/mid) / 50k-200k+ (enterprise) | Mid-market to conglomerates |
| Fixed-Fee Reporting Projects | 25k-120k per annual report engagement | IDX issuers (main board) |
| Retainer + Out-of-Scope | 3k-10k base + overage / month | Larger IDX issuers |

---

## 5. Confidence / Evidence Score

### 5.1 Confidence Legend
- **High (90%+):** Direct Indonesia firm page or release.
- **Medium (70-89%):** Global firm publication substantiated by Indonesia context or reputable financial media.
- **Low (50-69%):** Industry inference or non-Indonesia-specific benchmark.

### 5.2 Sources
| URL | Firm / Topic | Confidence |
|------------------------------------------------------------------|-----------------------------------|-----------|
| https://www.pwc.com/id/en/services/consulting/sustainability-and-climate-change.html | PwC Indonesia Traditional workflow | High |
| https://www.pwc.com/id/en/pwc-publications/services-publications/assurance-publications/transparency-report.html | PwC AI + assurance | High |
| https://www.pwc.com/gx/en/issues/esg/global-sustainability-reporting-survey.html | AI use cases survey | High |
| https://www.pwc.com/gx/en/about/global-annual-review/sustainability.html | ESG / AI investments | High |
| https://www.ey.com/en_id/services/climate-change-sustainability-services | EY Indonesia Traditional workflow | High |
| https://www.ey.com/en_id/services/assurance/sustainability-reporting-assurance-services | EY assurance | High |
| https://www.ey.com/en_id/insights/climate-change-sustainability-services/how-generative-ai-can-accelerate-value-led-sustainability | EY GenAI Indonesia | High |
| https://www.ey.com/en_id/services/managed-services/sustainability | EY Managed services | High |
| https://www.deloitte.com/southeast-asia/en/services/consulting/services/sustainability.html | Deloitte IN + AI | Medium |
| https://www.deloitte.com/southeast-asia/en/our-thinking/deloitte-indonesia-perspectives.html | Dec 2024 ESG / Dec 2025 AI | High |
| https://www.deloitte.com/us/en/what-we-do/capabilities/sustainability.html | Converge Global | Medium |
| https://newsroom.workiva.com/blog/deloitte-launches-new-esg-accelerators-workiva-platform-users-working-establish-or-enhance | Deloitte + Workiva accelerators | High |
| https://www.erm.com/about/locations/indonesia/ | ERM Indonesia Traditional workflow | High |
| https://www.erm.com/solutions/data-digital/ | ERM Digital | High |
| https://www.erm.com/about/news/erm-launches-esg-ratings-platform-for-private-markets/ | ERM ESG Fusion | High |
| https://www.erm.com/about/news/erm-and-auquan-bring-agentic-ai-to-sustainability-advisory/ | ERM + Auquan | High |
| https://www.erm.com/about/news/erm-and-osapiens-help-businesses-harness-esg-reporting/ | ERM + osapiens | High |
| https://www.workiva.com/solutions/esg-reporting | Workiva ESG | High |
| https://www.workiva.com/blog/issb-reporting-standards-how-will-your-business-be-impacted | Workiva IFRS S1/S2 | High |
| https://www.sap.com/products/scm/sustainability-control-tower.html | SAP SCT | High |
| https://www.sap.com/use-cases/automate-esg-report-creation | SAP SCT AI | High |
| https://www.pwc.de/en/strong-alliances/pwc-and-sap/pwcs-esg-reporting-manager-csrd.html | PwC CSRD.AI | High |
| https://cfotech.asia/story/indonesian-firms-introduce-ai-platform-for-faster-esg-reporting | Indonesian AI platform for ESG | Medium |
| https://environment-indonesia.com/laporan-keberlanjutan-sustainability-report-indonesia/ | POJK / SEOJK / IFRS mapping | High |
| https://www.slaughterandmay.com/services/practices/environmental-social-and-governance/esg-in-apac-2025/indonesia | Indonesia IFRS S1/S2 PSPK timeline | High |
| https://jurnal.unsil.ac.id/index.php/jak/article/view/15507 | IFRS S1/S2 to SEOJK academic mapping | Medium |
| https://www.frontiersin.org/articles/10.3389/frsus.2025.1668560/full | IDX ESG reporting adoption trends | High |
| https://pricinglink.com/knowledge-base/socially-responsible-investing-esg/beyond-hourly-billing-esg-services/ | ESG consulting retainers benchmark | Medium |
| https://www.deltek.com/en/blog/consulting-pricing-models | Consulting pricing models | Medium |

---

*Document prepared for internal SaaS MVP research. Content reflects publicly available sources as of 25 June 2026.*
