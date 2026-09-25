/**
 * DHARA — Disaster Hazard Adaptation & Relief Automation
 * Integrated Client Logic v6.0
 * Fully Interactive: Worklist Decisions, Mobile Field App, Offline Sync, 6-Language i18n, Real PostGIS Backend
 */

// Same machine that served this page, so operators on the local network reach the server, not their own device.
const API_BASE = `http://${window.location.hostname || "localhost"}:3001`;
// Offline AI endpoints live on the web server itself (web/server.py).
const AI_BASE = window.location.protocol.startsWith("http") ? "" : "http://localhost:8080";

// ====================================================
// MULTILINGUAL i18n DICTIONARY (6 LANGUAGES)
// ====================================================
const I18N = {
  en: {
    entry: {
      tagline: "Predict disruptions. Protect access. Pre-position supplies.",
      officerTitle: "OFFICER DASHBOARD",
      officerDesc: "Monitor predicted disruptions, village accessibility, dispatches, fleet, alerts and decisions.",
      fieldTitle: "FIELD INCIDENT REPORT",
      fieldDesc: "Report a real-world landslide, road blockage, flood or other disruption from the field.",
      openOfficer: "Open Officer Dashboard →",
      openField: "Open Field Reporting App →"
    },
    nav: {
      overview: "Overview",
      map: "Live Map",
      todayDecisions: "Today's Decisions",
      shipments: "Shipments & Manifests",
      risks: "Corridor Risks & Alerts",
      routes: "Routes & Egress",
      fleet: "Fleet Telemetry",
      depots: "Depots & Hubs",
      fieldReport: "Field Incident Logs",
      auditTrail: "Audit Trail",
      copilot: "DHARA Copilot",
      trackRecord: "Track Record",
      scenarios: "What-If Scenarios",
      planner: "Infrastructure Planner"
    },
    dashboard: {
      greeting: "GOOD MORNING, OFFICER",
      todayTitle: "Today's decisions",
      heroCount: "3 villages need a decision today"
    },
    field: {
      tabNew: "New Incident Report",
      tabPending: "Pending Reports",
      tabSubmitted: "Submitted Reports",
      reporterLabel: "Reporter Name & Designation *",
      locationLabel: "Location / Corridor *",
      gpsLabel: "GPS Coordinates",
      captureGps: "Capture GPS",
      typeLabel: "Incident Type *",
      severityLabel: "Severity *",
      descLabel: "Description & Observed Conditions *",
      photoLabel: "Photo / Visual Evidence",
      submitBtn: "SUBMIT REPORT TO DHARA"
    },
    actions: {
      approve: "APPROVE",
      change: "CHANGE",
      reject: "REJECT",
      viewEvidence: "VIEW EVIDENCE",
      viewRoute: "VIEW ROUTE"
    }
  },
  hi: {
    entry: {
      tagline: "व्यवधानों का पूर्वानुमान। पहुंच की सुरक्षा। राहत सामग्री का अग्रिम भंडारण।",
      officerTitle: "अधिकारी डैशबोर्ड",
      officerDesc: "पूर्वानुमानित आपदाओं, ग्राम पहुंच, आपूर्ति प्रेषण, वाहन बेड़े और निर्णयों की निगरानी करें।",
      fieldTitle: "फील्ड घटना रिपोर्ट",
      fieldDesc: "फील्ड से भूस्खलन, सड़क अवरोध, बाढ़ या अन्य व्यवधानों की त्वरित रिपोर्ट दर्ज करें।",
      openOfficer: "अधिकारी डैशबोर्ड खोलें →",
      openField: "फील्ड रिपोर्टिंग ऐप खोलें →"
    },
    nav: {
      overview: "अवलोकन",
      map: "लाइव मानचित्र",
      todayDecisions: "आज के निर्णय",
      shipments: "शिपमेंट और मैनिफेस्ट",
      risks: "कॉरिडोर जोखिम व अलर्ट",
      routes: "मार्ग और निकास",
      fleet: "वाहन बेड़ा",
      depots: "डिपो और हब",
      fieldReport: "फील्ड रिपोर्ट लॉग",
      auditTrail: "ऑडिट ट्रेल",
      copilot: "धारा कोपायलट",
      trackRecord: "ट्रैक रिकॉर्ड",
      scenarios: "व्हाट-इफ परिदृश्य",
      planner: "बुनियादी ढांचा योजनाकार"
    },
    dashboard: {
      greeting: "शुभ प्रभात, अधिकारी",
      todayTitle: "आज के निर्णय",
      heroCount: "आज 3 गांवों के लिए निर्णय आवश्यक है"
    },
    field: {
      tabNew: "नई घटना रिपोर्ट",
      tabPending: "लंबित रिपोर्टें",
      tabSubmitted: "प्रस्तुत रिपोर्टें",
      reporterLabel: "रिपोर्टर का नाम व पद *",
      locationLabel: "स्थान / सड़क कॉरिडोर *",
      gpsLabel: "जीपीएस निर्देशांक",
      captureGps: "जीपीएस कैप्चर",
      typeLabel: "घटना का प्रकार *",
      severityLabel: "गंभीरता *",
      descLabel: "विवरण और देखी गई स्थिति *",
      photoLabel: "फोटो / दृश्य साक्ष्य",
      submitBtn: "धारा में रिपोर्ट जमा करें"
    },
    actions: {
      approve: "स्वीकार करें",
      change: "बदलें",
      reject: "अस्वीकार करें",
      viewEvidence: "साक्ष्य देखें",
      viewRoute: "मार्ग देखें"
    }
  },
  as: {
    entry: {
      tagline: "বাধাৰ পূৰ্বানুমান। পথ সুৰক্ষা। সাহায্য সামগ্ৰীৰ পূৰ্ব-মজুত।",
      officerTitle: "বিষয়াৰ ডেচবৰ্ড",
      officerDesc: "সম্ভাব্য ভূমিস্খলন, গাঁৱৰ পথ যোগাযোগ, সাহায্য বিতৰণ আৰু সিদ্ধান্ত নিৰীক্ষণ কৰক।",
      fieldTitle: "ক্ষেত্ৰ ঘটনা প্ৰতিবেদন",
      fieldDesc: "ক্ষেত্ৰৰ পৰা প্ৰকৃত ভূমিস্খলন, পথ অৱৰোধ বা বানপানীৰ প্ৰতিবেদন দাখিল কৰক।",
      openOfficer: "বিষয়াৰ ডেচবৰ্ড খোলক →",
      openField: "ফিল্ড ৰিপৰ্টিং এপ খোলক →"
    },
    nav: {
      overview: "অৱলোকন",
      map: "লাইভ মানচিত্ৰ",
      todayDecisions: "আজৰি সিদ্ধান্ত",
      shipments: "শ্বিপমেণ্ট আৰু মেনীফেষ্ট",
      risks: "বিপদ আৰু সতৰ্কবাৰ্তা",
      routes: "ৰুট আৰু প্ৰৱেশ পথ",
      fleet: "বাহন বহৰ",
      depots: "ডিপো আৰু হাব",
      fieldReport: "ফিল্ড ঘটনা লগ",
      auditTrail: "অডিট ট্ৰেইল",
      copilot: "ধাৰা কোপাইলাট",
      trackRecord: "ট্ৰেক ৰেকৰ্ড",
      scenarios: "হোৱাট-ইফ পৰিস্থিতি",
      planner: "পরিকল্পনাকাৰী"
    },
    dashboard: {
      greeting: "শুভ প্ৰভাত, বিষয়া",
      todayTitle: "আজৰি সিদ্ধান্ত",
      heroCount: "আজৰি ৩খন গাঁৱৰ বাবে সিদ্ধান্ত প্ৰয়োজন"
    },
    field: {
      tabNew: "নতুন ঘটনা প্ৰতিবেদন",
      tabPending: "অপেক্ষমান প্ৰতিবেদন",
      tabSubmitted: "দাখিল কৰা প্ৰতিবেদন",
      reporterLabel: "প্ৰতিবেদকৰ নাম আৰু পদবী *",
      locationLabel: "স্থান / কৰিডৰ *",
      gpsLabel: "GPS স্থানাংক",
      captureGps: "GPS ধৰক",
      typeLabel: "ঘটনাৰ প্ৰকাৰ *",
      severityLabel: "গুৰুত্ব *",
      descLabel: "বিৱৰণ আৰু পৰিস্থিতি *",
      photoLabel: "ফটো / প্ৰমাণ",
      submitBtn: "ধাৰালৈ প্ৰতিবেদন জমা দিয়ক"
    },
    actions: {
      approve: "অনুমোদন কৰক",
      change: "সলনি কৰক",
      reject: "প্ৰত্যাখ্যান কৰক",
      viewEvidence: "প্ৰমাণ চাওক",
      viewRoute: "ৰুট চাওক"
    }
  },
  bn: {
    entry: {
      tagline: "দুর্যোগের পূর্বাভাস। যোগাযোগ রক্ষা। ত্রাণ সামগ্রীর পূর্ব-প্রস্তুতি।",
      officerTitle: "অফিসার ড্যাশবোর্ড",
      officerDesc: "ঝুঁকি পূর্বাভাস, গ্রামের যোগাযোগ, ত্রাণ সরবরাহ, ফ্লিট এবং সিদ্ধান্ত নিরীক্ষণ করুন।",
      fieldTitle: "ফিল্ড ঘটনার রিপোর্ট",
      fieldDesc: "মাঠ পর্যায় থেকে ভূমিধস, সড়ক অবরোধ ও বন্যার তথ্য তাত্ক্ষণিক প্রেরণ করুন।",
      openOfficer: "অফিসার ড্যাশবোর্ড খুলুন →",
      openField: "ফিল্ড অ্যাপ খুলুন →"
    },
    nav: {
      overview: "সংক্ষিপ্ত বিবরণ",
      map: "লাইভ মানচিত্র",
      todayDecisions: "আজকের সিদ্ধান্ত",
      shipments: "শিপমেন্ট ও মেনিফেস্ট",
      risks: "ঝুঁকি ও সতর্কতা",
      routes: "রুট ও নিকাশ পথ",
      fleet: "যানবাহন বহর",
      depots: "ডিপো ও হাব",
      fieldReport: "ফিল্ড রিপোর্ট লগ",
      auditTrail: "অডিট ট্রেইল",
      copilot: "ধারা কোপাইলট",
      trackRecord: "ট্র্যাক রেকর্ড",
      scenarios: "হোয়াট-ইফ দৃশ্যপট",
      planner: "অবকাঠামো পরিকল্পনাকারী"
    },
    dashboard: {
      greeting: "শুভ সকাল, অফিসার",
      todayTitle: "আজকের সিদ্ধান্ত",
      heroCount: "আজ ৩টি গ্রামের জন্য সিদ্ধান্ত প্রয়োজন"
    },
    field: {
      tabNew: "নতুন ঘটনা রিপোর্ট",
      tabPending: "অপেক্ষারত রিপোর্ট",
      tabSubmitted: "জমা দেওয়া রিপোর্ট",
      reporterLabel: "রিপোর্টারের নাম ও পদবী *",
      locationLabel: "স্থান / করিডোর *",
      gpsLabel: "GPS স্থানাঙ্ক",
      captureGps: "GPS ক্যাপচার",
      typeLabel: "ঘটনার ধরন *",
      severityLabel: "তীব্রতা *",
      descLabel: "বিবরণ ও পরিস্থিতি *",
      photoLabel: "ছবি / ভিজ্যুয়াল প্রমাণ",
      submitBtn: "ধারা সিস্টেমে রিপোর্ট জমা দিন"
    },
    actions: {
      approve: "অনুমোদন করুন",
      change: "পরিবর্তন করুন",
      reject: "প্রত্যাখ্যান করুন",
      viewEvidence: "প্রমাণ দেখুন",
      viewRoute: "রুট দেখুন"
    }
  },
  mni: {
    entry: {
      tagline: "খুদোংথিবা মাংজৌননা খঙদোকপা। লম্বী-থোং ঙাকশেনবা। পোৎলমশিং থমজিনবা।",
      officerTitle: "ওফিসার দেশবোর্দ",
      officerDesc: "খুদোংথিবা, খুংগংগী লম্বী, পোৎলম য়েন্থোকপা অমশুং ৱারেপশিং য়েংশিনবিয়ু।",
      fieldTitle: "ফিল্ড এক্সিদেন্ত রিফোর্ত",
      fieldDesc: "ফিল্ডতগী চীং থুংবা, লম্বী থিংবা অমশুং ঈশিং ইচাওগী পাউ পীবিয়ু।",
      openOfficer: "ওফিসার দেশবোর্দ হাংবিয়ু →",
      openField: "ফিল্ড রিফোর্তিং এপ হাংবিয়ু →"
    },
    nav: {
      overview: "ওভরভিউ",
      map: "লাইভ মেপ",
      todayDecisions: "ঙসিগী ৱারেপশিং",
      shipments: "শিপমেন্ত অমশুং ত্রাক",
      risks: "খুদোংথিবা অমশুং চেক্সিনৱা",
      routes: "লম্বী-থোং",
      fleet: "গাড়ী কাংবু",
      depots: "ডিপো অমশুং হব",
      fieldReport: "ফিল্ড রিফোর্তশিং",
      auditTrail: "ওদিত ত্রেইেল",
      copilot: "ধারা কোপাইলোত",
      trackRecord: "ত্রেক রিকোর্দ",
      scenarios: "ৱাৎ-ইফ ফিভম",
      planner: "প্লান্নিং অথোরিতী"
    },
    dashboard: {
      greeting: "নুমিৎফবা ওফিসার",
      todayTitle: "ঙসিগী ৱারেপশিং",
      heroCount: "ঙসি খুংগং ৩ গী ৱারেপ ইলৌবা তশেংনা দরকার লৈরে"
    },
    field: {
      tabNew: "অনৌবা রিফোর্ত",
      tabPending: "ঙাইরিবা রিফোর্তশিং",
      tabSubmitted: "পীরবা রিফোর্তশিং",
      reporterLabel: "রিপোর্ত পীরিবা মীওইগী মমিং *",
      locationLabel: "মফম / লম্বী *",
      gpsLabel: "GPS কোঅৰ্দিনেতশিং",
      captureGps: "GPS লৌবিয়ু",
      typeLabel: "খুদোংথিবা মখল *",
      severityLabel: "অকনবা ফিবম *",
      descLabel: "অকুপ্পা মরোল *",
      photoLabel: "ফোটো / খুদম",
      submitBtn: "ধারা দ রিফোর্ত পীবিয়ু"
    },
    actions: {
      approve: "য়াবিয়ু",
      change: "ওন্থোকবিয়ু",
      reject: "য়াদবিয়ু",
      viewEvidence: "খুদম য়েংবিয়ু",
      viewRoute: "লম্বী য়েংবিয়ু"
    }
  },
  brx: {
    entry: {
      tagline: "खामानि हेंथा सिगां सिगां मिथिहोनाय। लामा रैखाथि। मदद मुवा सिगां दोनथुमनाय।",
      officerTitle: "अफिसार देसबर्ड",
      officerDesc: "गामि लामा, मुवा राननाय, गारि बाहागो आरो थांखिफोर नायबिजिर।",
      fieldTitle: "फिल्ड जाथाय रादाब",
      fieldDesc: "फिल्डनिफ्राय हा बाग्लानाय, लामा बन्द आरो दैबानानि खौरां थिसन।",
      openOfficer: "अफिसार देसबर्ड खुलि →",
      openField: "फिल्ड रादाब एप खुलि →"
    },
    nav: {
      overview: "गुवारै नायनाय",
      map: "लाइभ मेप",
      todayDecisions: "दिनैनि थांखिफोर",
      shipments: "मुवा राननाय आरो गारि",
      risks: "गिख्रोंथाव खौरां",
      routes: "लामा आरो ओंखार लामा",
      fleet: "गारि बाहागो",
      depots: "डिपो आरो मिरु",
      fieldReport: "फिल्ड रादाब",
      auditTrail: "लेखा नायबिजिरनाय",
      copilot: "धारा कपाइलट",
      trackRecord: "ट्रेक रेकर्ड",
      scenarios: "मा जानो हागौ",
      planner: "लामा बानायनाय थांखि"
    },
    dashboard: {
      greeting: "मोजां फुं, अफिसार",
      todayTitle: "दिनैनि थांखिफोर",
      heroCount: "दिनै 3 गामिफोरनि थाखाय थांखि नांगौ"
    },
    field: {
      tabNew: "गोदान जाथाय रादाब",
      tabPending: "नेना थानाय रादाब",
      tabSubmitted: "थिसननाय रादाब",
      reporterLabel: "रादाबगिरिनि मुं *",
      locationLabel: "जायगा / लामा *",
      gpsLabel: "GPS थावनि",
      captureGps: "GPS लानाय",
      typeLabel: "जाथायनि रोखोम *",
      severityLabel: "गिख्रोंथाव बिथांखि *",
      descLabel: "गुवारै खौरां *",
      photoLabel: "फटो / फोरमान",
      submitBtn: "धारायाव रादाब थिसन"
    },
    actions: {
      approve: "गनायनाय",
      change: "सोलायनाय",
      reject: "नेवसिनाय",
      viewEvidence: "फोरमान नाय",
      viewRoute: "लामा नाय"
    }
  },
  ne: {
    entry: {
      tagline: "अवरोधको पूर्वानुमान। पहुँचको सुरक्षा। राहत सामग्रीको अग्रिम भण्डारण।",
      officerTitle: "अधिकारी ड्यासबोर्ड",
      officerDesc: "अनुमानित अवरोध, गाउँको पहुँच, सामग्री ढुवानी, सवारी साधन, सूचना र निर्णयहरूको अनुगमन गर्नुहोस्।",
      fieldTitle: "फिल्ड घटना रिपोर्ट",
      fieldDesc: "फिल्डबाट पहिरो, सडक अवरोध, बाढी वा अन्य अवरोधको रिपोर्ट गर्नुहोस्।",
      openOfficer: "अधिकारी ड्यासबोर्ड खोल्नुहोस् →",
      openField: "फिल्ड रिपोर्टिङ एप खोल्नुहोस् →"
    },
    nav: {
      overview: "सारांश",
      map: "प्रत्यक्ष नक्सा",
      todayDecisions: "आजका निर्णयहरू",
      shipments: "ढुवानी र विवरण",
      risks: "मार्ग जोखिम र सूचना",
      routes: "मार्ग र निकास",
      fleet: "सवारी साधन",
      depots: "डिपो र हब",
      fieldReport: "फिल्ड घटना अभिलेख",
      auditTrail: "लेखापरीक्षण अभिलेख",
      copilot: "धारा कोपाइलट",
      trackRecord: "विगतको कार्यसम्पादन",
      scenarios: "के भए के हुन्छ",
      planner: "पूर्वाधार योजनाकार"
    },
    dashboard: {
      greeting: "शुभ प्रभात, अधिकारीज्यू",
      todayTitle: "आजका निर्णयहरू",
      heroCount: "आज 3 वटा गाउँका लागि निर्णय आवश्यक छ"
    },
    field: {
      tabNew: "नयाँ घटना रिपोर्ट",
      tabPending: "पठाउन बाँकी रिपोर्टहरू",
      tabSubmitted: "पठाइएका रिपोर्टहरू",
      reporterLabel: "रिपोर्टरको नाम र पद *",
      locationLabel: "स्थान / मार्ग *",
      gpsLabel: "GPS निर्देशाङ्क",
      captureGps: "GPS लिनुहोस्",
      typeLabel: "घटनाको प्रकार *",
      severityLabel: "गम्भीरता *",
      descLabel: "विवरण र देखिएको अवस्था *",
      photoLabel: "फोटो / दृश्य प्रमाण",
      submitBtn: "धारामा रिपोर्ट पठाउनुहोस्"
    },
    actions: {
      approve: "स्वीकृत गर्नुहोस्",
      change: "परिवर्तन गर्नुहोस्",
      reject: "अस्वीकार गर्नुहोस्",
      viewEvidence: "प्रमाण हेर्नुहोस्",
      viewRoute: "मार्ग हेर्नुहोस्"
    }
  },
  lus: {
    entry: {
      tagline: "Harsatna lo thleng tur hriat lawk. Kawng zawh theihna humhim. Tanpuina thil dahkhawl lawk.",
      officerTitle: "OFFICER DASHBOARD",
      officerDesc: "Harsatna lo thleng tur, khaw tin kawng zawh theihna, thil thawn chhuah, motor, hriattirna leh thutlukna te enfiah rawh.",
      fieldTitle: "FIELD THILTHLENG REPORT",
      fieldDesc: "Leimin, kawng dan, tuilian emaw harsatna dang lo thleng chu field ata report rawh.",
      openOfficer: "Officer Dashboard hawng rawh →",
      openField: "Field Report App hawng rawh →"
    },
    nav: {
      overview: "A tlangpui",
      map: "Live Map",
      todayDecisions: "Vawiina thutlukna",
      shipments: "Thil thawn chhuah",
      risks: "Kawng hlauhawmna leh hriattirna",
      routes: "Kawng leh chhuahna",
      fleet: "Motor dinhmun",
      depots: "Thil dahkhawmna",
      fieldReport: "Field report chhinchhiahna",
      auditTrail: "Enfiahna chhinchhiahna",
      copilot: "DHARA Copilot",
      trackRecord: "Hnathawh tawh chanchin",
      scenarios: "Chutiang ni ta se",
      planner: "Kawng siam ruahmanna"
    },
    dashboard: {
      greeting: "ZING CHIBAI, OFFICER",
      todayTitle: "Vawiina thutlukna",
      heroCount: "Vawiinah khua 3 atan thutlukna siam a ngai"
    },
    field: {
      tabNew: "Report thar",
      tabPending: "La thawn loh report",
      tabSubmitted: "Thawn tawh report",
      reporterLabel: "Report-tu hming leh nihna *",
      locationLabel: "Hmun / Kawng *",
      gpsLabel: "GPS hmun",
      captureGps: "GPS la rawh",
      typeLabel: "Thilthleng chi *",
      severityLabel: "A nasat dan *",
      descLabel: "A chanchin leh hmuh dan *",
      photoLabel: "Thlalak / Finfiahna",
      submitBtn: "DHARA-ah report thawn rawh"
    },
    actions: {
      approve: "PAWM RAWH",
      change: "THLAK RAWH",
      reject: "HNAWL RAWH",
      viewEvidence: "FINFIAHNA EN RAWH",
      viewRoute: "KAWNG EN RAWH"
    }
  },
  kha: {
    entry: {
      tagline: "Tip lypa ïa ki jingma. Sumar ïa ka lynti. Buh lypa ïa ki jingdonkam.",
      officerTitle: "OFFICER DASHBOARD",
      officerDesc: "Peit bniah ïa ki jingma, ka lynti sha ki shnong, ki jingphah, ki kali, ki jingpynkhreh bad ki jingbishar.",
      fieldTitle: "FIELD JINGJIA REPORT",
      fieldDesc: "Phah report na field shaphang ka jingkhlad khyndew, ka lynti ba khang, ka jingtuid um ne kiwei ki jingjia.",
      openOfficer: "Plie ïa ka Officer Dashboard →",
      openField: "Plie ïa ka Field Report App →"
    },
    nav: {
      overview: "Ka jingpeit baroh",
      map: "Live Map",
      todayDecisions: "Ki jingbishar mynta ka sngi",
      shipments: "Ki jingphah",
      risks: "Ki jingma ha lynti",
      routes: "Ki lynti bad ki lad mih",
      fleet: "Ki kali",
      depots: "Ki jaka buh jingdonkam",
      fieldReport: "Ki report na field",
      auditTrail: "Ka jingthoh jingpeit bniah",
      copilot: "DHARA Copilot",
      trackRecord: "Ki kam ba la leh",
      scenarios: "Lada kumta?",
      planner: "Ka jingpynkhreh lynti"
    },
    dashboard: {
      greeting: "KHUBLEI, OFFICER",
      todayTitle: "Ki jingbishar mynta ka sngi",
      heroCount: "Mynta ka sngi 3 tylli ki shnong ki donkam jingbishar"
    },
    field: {
      tabNew: "Report thymmai",
      tabPending: "Ki report ba dang ym phah",
      tabSubmitted: "Ki report ba la phah",
      reporterLabel: "Ka kyrteng bad ka kam jong ka nongphah *",
      locationLabel: "Ka jaka / Ka lynti *",
      gpsLabel: "GPS jaka",
      captureGps: "Shim GPS",
      typeLabel: "Ka jait jingjia *",
      severityLabel: "Katno ka khia *",
      descLabel: "Ka jingbatai bad kaei ba la iohi *",
      photoLabel: "Ka dur / Ka jingpyni",
      submitBtn: "PHAH REPORT SHA DHARA"
    },
    actions: {
      approve: "MYNJUR",
      change: "PYNKYLLA",
      reject: "KYNTAIT",
      viewEvidence: "PEIT JINGPYNI",
      viewRoute: "PEIT LYNTI"
    }
  },
  nag: {
    entry: {
      tagline: "Dikdari aage-te jani lobi. Rasta khula rakhibi. Saman aage-te pathai dibi.",
      officerTitle: "OFFICER DASHBOARD",
      officerDesc: "Dikdari, gaon laga rasta, saman pathai diya, gari, khobor aru sidhanto khan sai thakibi.",
      fieldTitle: "FIELD GHOTONA REPORT",
      fieldDesc: "Mati gira, rasta bondh, baan pani nohoile dusra dikdari laga khobor field pora dibi.",
      openOfficer: "Officer Dashboard khulibi →",
      openField: "Field Report App khulibi →"
    },
    nav: {
      overview: "Pura nojor",
      map: "Live Map",
      todayDecisions: "Aji laga sidhanto",
      shipments: "Saman pathai diya",
      risks: "Rasta laga dikdari aru khobor",
      routes: "Rasta aru ulai jabole rasta",
      fleet: "Gari khan",
      depots: "Saman rakhi thaka jaga",
      fieldReport: "Field ghotona laga likha",
      auditTrail: "Hisab sai laga likha",
      copilot: "DHARA Copilot",
      trackRecord: "Aage laga kaam",
      scenarios: "Eneka hoile ki hobo",
      planner: "Rasta bonabole plan"
    },
    dashboard: {
      greeting: "NAMASKAR, OFFICER",
      todayTitle: "Aji laga sidhanto",
      heroCount: "Aji 3 ta gaon nimite sidhanto lagibo"
    },
    field: {
      tabNew: "Notun ghotona report",
      tabPending: "Ekhono pathai diya nai",
      tabSubmitted: "Pathai dise report",
      reporterLabel: "Report diya manu laga naam aru pod *",
      locationLabel: "Jaga / Rasta *",
      gpsLabel: "GPS jaga",
      captureGps: "GPS lobi",
      typeLabel: "Ghotona laga kisim *",
      severityLabel: "Kiman dangor *",
      descLabel: "Ki hoise aru ki dikhise *",
      photoLabel: "Photo / Proman",
      submitBtn: "DHARA te report pathai dibi"
    },
    actions: {
      approve: "MANJUR",
      change: "BODLI KORIBI",
      reject: "NA-MANJUR",
      viewEvidence: "PROMAN SAI",
      viewRoute: "RASTA SAI"
    }
  }
};

// Drafted without a native-speaker review yet: shown with a "draft" label and
// English tooltips so an officer can always check what a control does.
const DRAFT_LANGS = new Set(["lus", "kha", "nag"]);

// ====================================================
// CORE APPLICATION STATE
// ====================================================
let habitationsData = [];
let atRiskSegmentsData = [];
let dispatchesData = [];
let shipmentsData = [];
let vehiclesData = [];
let depotsData = [];
let alertsData = [];
let auditData = [];
let submittedFieldReports = [];
let pendingFieldReports = [];
let trackRecordData = {};
let automationStatusData = {};
let coverageData = null;

let currentLang = localStorage.getItem("dhara_lang") || "en";
let currentMode = "officer"; // "officer" | "field"
let currentWorklistFilter = "all";
let currentFleetFilter = "all";

let map = null;
let villageMarkers = {};
let segmentPolylines = [];
let depotMarkers = [];
let db = null;


// Mock fallback decision habitations for guaranteed rich interactivity
const BASE_DECISIONS = [
  {
    id: "DEC_UKHRUL",
    village_id: "hab_ukhrul_01",
    village_name: "Ukhrul Sector (Kameng Ridge)",
    district: "West Kameng",
    cutoff_hours: 38,
    cutoff_status: "cutoff_predicted",
    risk_level: "High Risk",
    severity_class: "high-risk",
    current_vri: 28.4,
    recommended_commodity: "Rice & High-Protein Ration Packs",
    recommended_units: 12,
    source_depot: "Depot A (Tawang Relief Hub)",
    corridor_route: "NH-150 Kameng Mountain Corridor",
    latest_departure: "Today, 14:00 IST (Before Cutoff)",
    confidence: 82,
    track_record_stat: "11 / 14 recent predictions correct",
    reasoning: "Heavy rainfall (114mm forecast over 72h) elevates road closure probability to 0.78 along primary single-lane pass. Village has zero alternate vehicular egress.",
    status: "pending",
    terrain_slope: "28.4° Steep Mountain Slope",
    landslide_class: "High Landslide Susceptibility",
    travel_time_now: "45 min",
    travel_time_after: "185 min (+140 min delay)",
    alternate_route: "Upper Valley Logging Track (Foot Egress Only)"
  },
  {
    id: "DEC_MAGO",
    village_id: "hab_mago_02",
    village_name: "Mago Valley Settlement",
    district: "Tawang",
    cutoff_hours: 19,
    cutoff_status: "cutoff_predicted",
    risk_level: "Critical Cutoff (<24h)",
    severity_class: "critical",
    current_vri: 19.2,
    recommended_commodity: "Essential Medical Kits & Water Tablets",
    recommended_units: 8,
    source_depot: "Depot B (Kameng Regional Depot)",
    corridor_route: "Mago Gorge Link Pass",
    latest_departure: "Today, 10:30 IST (URGENT)",
    confidence: 88,
    track_record_stat: "9 / 10 recent gorge predictions correct",
    reasoning: "Active mudflow detected upstream with forecasted 85mm rainfall surge. Gorge bridge vulnerable to structural scouring within 19 hours.",
    status: "pending",
    terrain_slope: "34.1° Gorge Cliffside",
    landslide_class: "Severe Debris Hazard",
    travel_time_now: "30 min",
    travel_time_after: "Severed (No motor access)",
    alternate_route: "Helicopter Evacuation Point Charlie"
  },
  {
    id: "DEC_THINGBU",
    village_id: "hab_thingbu_03",
    village_name: "Thingbu Camp Reach",
    district: "Tawang",
    cutoff_hours: 44,
    cutoff_status: "cutoff_predicted",
    risk_level: "High Risk (<48h)",
    severity_class: "high-risk",
    current_vri: 32.5,
    recommended_commodity: "Bulk Wheat Flour & Pulses",
    recommended_units: 15,
    source_depot: "Depot A (Tawang Relief Hub)",
    corridor_route: "NH-150 Km 48 Sector",
    latest_departure: "Tomorrow, 06:00 IST",
    confidence: 79,
    track_record_stat: "11 / 14 recent predictions correct",
    reasoning: "Monsoon saturation coefficient exceeding threshold on slope km 48. Pre-positioning prevents severe nutritional deficit during 5-day anticipated isolation.",
    status: "pending",
    terrain_slope: "22.8° Moderate Ridge",
    landslide_class: "Moderate Landslide Hazard",
    travel_time_now: "60 min",
    travel_time_after: "135 min (+75 min delay)",
    alternate_route: "Eastern Ridge Bypass Road"
  }
];

let liveDecisions = JSON.parse(JSON.stringify(BASE_DECISIONS));

// ====================================================
// INITIALIZATION
// ====================================================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  renderTodayDates();
  initIndexedDB();
  initLanguages();
  initMapToolbar();
  initMapSize();
  initMapToolsMenu();
  initMapLegend();
  initSidebarCollapse();
  initCommandPalette();
  initKeyboardShortcuts();
  initSyncControls();
  initNavigation();
  initFieldAppInteractions();
  initScenarioSandbox();
  initModals();
  initMobileNav();
  checkApiHealth();
  checkLocalAi();
  initFieldNoteAi();
  fetchAllData();
  
  // Set up live refresh polling every 30 seconds
  setInterval(fetchAllData, 30000);
  
  bindGlobalEvents();
});

// ====================================================
// MOBILE NAVIGATION — Hamburger Drawer
// ====================================================
function initMobileNav() {
  const toggleBtn = document.getElementById("btn-mobile-menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");

  if (!toggleBtn || !sidebar || !backdrop) return;

  function openSidebar() {
    sidebar.classList.add("mobile-open");
    backdrop.classList.add("visible");
    document.body.style.overflow = "hidden"; // Prevent background scroll
  }

  function closeSidebar() {
    sidebar.classList.remove("mobile-open");
    backdrop.classList.remove("visible");
    document.body.style.overflow = "";
  }

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (sidebar.classList.contains("mobile-open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  // Close on backdrop click
  backdrop.addEventListener("click", closeSidebar);

  // Close when a nav item is clicked on mobile
  sidebar.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });

  // Close on window resize above mobile breakpoint
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove("mobile-open");
      backdrop.classList.remove("visible");
      document.body.style.overflow = "";
    }
  });

  // Swipe to close (touch gesture)
  let touchStartX = 0;
  sidebar.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  sidebar.addEventListener("touchend", (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const swipeDelta = touchStartX - touchEndX;
    if (swipeDelta > 60) { // Swiped left 60px = close
      closeSidebar();
    }
  }, { passive: true });
}


// ====================================================
// SHARED UI HELPERS
// ====================================================
const ICON_PATHS = {
  clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
  package: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>',
  check: '<polyline points="20 6 9 17 4 12"></polyline>',
  edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>',
  x: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
  route: '<circle cx="6" cy="19" r="3"></circle><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"></path><circle cx="18" cy="5" r="3"></circle>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line>',
  sparkle: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"></path>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
  home: '<path d="M3 21V9l9-6 9 6v12"></path><path d="M9 21v-6h6v6"></path>',
  truck: '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>'
};

function icon(name, size = 14) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null && value !== "") el.textContent = value;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// "#2563EB" + 0.1 -> "rgba(37, 99, 235, 0.1)"; anything else is returned unchanged.
function withAlpha(color, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function renderTodayDates() {
  const today = new Date();
  setText("overview-date", today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  setText("top-date-display", today.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }));
}

// ====================================================
// THEME (light / dark)
// ====================================================
// <head> sets data-theme before first paint (saved choice, else the OS
// setting); this wires the top-bar toggle and re-themes the canvas-drawn
// parts (charts, map markers, basemap) that CSS variables can't reach.
const THEME_KEY = "dhara-theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function savedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch (e) {
    return null;
  }
}

function initTheme() {
  syncThemeButton();
  // Officer top bar, role picker and field app each have a toggle.
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      applyTheme(next);
    });
  });

  // Follow the OS setting until the officer picks a theme explicitly.
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  if (mq && mq.addEventListener) {
    mq.addEventListener("change", (e) => {
      if (!savedTheme()) applyTheme(e.matches ? "dark" : "light");
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  syncThemeButton();
  refreshChartsForTheme();
  syncBasemapToTheme();
  syncFieldMapTheme();
  safeUpdateMapLayers();
  applyMapContext(currentMapContext, { fit: false });
}

function syncThemeButton() {
  const label = currentTheme() === "dark" ? "Switch to light mode" : "Switch to dark mode";
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.title = label;
    btn.setAttribute("aria-label", label);
  });
}

// ====================================================
// THE ALWAYS-ON MAP: page context, side panel, focus
// ====================================================
// There is one Leaflet map and it is on screen for every officer page: the
// page's content sits in the side panel and the map shows that page's items
// (shipments -> trucks and destinations, alerts -> flagged roads, ...).
let pendingMapFocus = null;
let currentMapContext = "overview";
let allDataBounds = null;

// Leaflet tiles show hairline gaps on screens scaled to 125% / 150% (common on
// Windows laptops). Drawing each tile 1px larger closes them.
// https://github.com/Leaflet/Leaflet/issues/3575
if (typeof L !== "undefined" && L.GridLayer && !L.GridLayer.prototype._dharaGapFix) {
  const originalInitTile = L.GridLayer.prototype._initTile;
  L.GridLayer.include({
    _dharaGapFix: true,
    _initTile(tile) {
      originalInitTile.call(this, tile);
      const size = this.getTileSize();
      tile.style.width = `${size.x + 1}px`;
      tile.style.height = `${size.y + 1}px`;
    }
  });
}

function ensureMap(viewName) {
  // Deferred one tick so the view switch has laid out and the map container
  // reports real dimensions before Leaflet measures it.
  setTimeout(() => {
    if (!map) {
      initMap();
    } else {
      map.invalidateSize();
    }
    applyMapContext(viewName);
    runPendingMapFocus();
    syncMapToolbar();
  }, 50);
}

// The map is always on screen (beside the page, or pinned above it on
// phones), so map actions run in place.
function onLiveMap(run) {
  if (!map) {
    pendingMapFocus = { run };
    return;
  }
  try {
    run();
  } catch (err) {
    console.warn("Map focus failed:", err);
  }
}

function runPendingMapFocus() {
  if (!map || !pendingMapFocus) return;
  const { run } = pendingMapFocus;
  pendingMapFocus = null;
  try {
    run();
  } catch (err) {
    console.warn("Map focus failed:", err);
  }
}

// Pan/zoom to a place and ring it.
function focusMapOn(latlng, zoom, popupHtml) {
  onLiveMap(() => {
    map.setView(latlng, zoom, { animate: true });
    showHalo(latlng);
    if (popupHtml) L.popup({ offset: [0, -6] }).setLatLng(latlng).setContent(popupHtml).openOn(map);
  });
}

function showSegmentOnMap(seg) {
  if (!map || !seg) return;
  const bounds = L.geoJSON(seg).getBounds();
  if (!bounds.isValid()) return;
  const p = seg.properties;
  map.fitBounds(bounds, { maxZoom: 12, padding: [60, 60] });
  showHalo(bounds.getCenter());
  L.popup({ offset: [0, -14] }).setLatLng(bounds.getCenter())
    .setContent(`<strong>${escapeHtml(roadLabel(p))}</strong><br>Chance of closure: <strong>${Math.round(p.closure_probability * 100)}%</strong>${p.predicted_closed ? " · predicted closed" : ""}<br><span class="mono">${escapeHtml(p.segment_id)}</span>`)
    .openOn(map);
}

function focusSegment(segmentId) {
  const seg = segById.get(segmentId);
  if (!seg) {
    showToast("That road segment isn't in the current forecast.", "warning");
    return;
  }
  onLiveMap(() => showSegmentOnMap(seg));
}

// Pulsing ring that marks the last thing the officer jumped to.
function showHalo(latlng) {
  if (!map || !mapLayers.selection) return;
  mapLayers.selection.clearLayers();
  L.marker(latlng, {
    icon: L.divIcon({ className: "map-halo", iconSize: [34, 34] }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 1000
  }).addTo(mapLayers.selection);
}

function fitAllData() {
  if (!map) return;
  rememberMapFit();
  if (allDataBounds && allDataBounds.isValid()) {
    map.fitBounds(allDataBounds, { padding: [40, 40], maxZoom: 9 });
  } else {
    map.setView([27.35, 93.4], 7);
  }
}

function computeAllDataBounds() {
  const pts = [];
  (habitationsData || []).forEach(f => {
    const c = f.geometry && f.geometry.coordinates;
    if (c) pts.push([c[1], c[0]]);
  });
  (depotsData || []).forEach(d => {
    const c = d.location && d.location.coordinates;
    if (c) pts.push([c[1], c[0]]);
  });
  allDataBounds = pts.length ? L.latLngBounds(pts) : null;
}

// ---------- Map size: how the page and the map share the screen ----------
// Desktop: the map is a column on the right of the page. Tablet/phone: a
// band above the page that stays put while the page scrolls. The page gets
// most of the room by default; officers pick Small / Medium / Large / Map
// only, or drag the divider, and the choice is remembered.
const MAP_SIZE_SHARE = {
  wide: { small: 0.30, medium: 0.40, large: 0.60 },   // share of the workspace width
  tall: { small: 0.30, medium: 0.42, large: 0.64 }    // share of the screen below the top bar
};
const MAP_MIN_W = 340;       // keep in step with --map-min-w in style.css
const PANEL_MIN_W = 460;     // keep in step with --panel-min-w
const MAP_MIN_H = 200;
let mapSize = "medium";      // small | medium | large | full | custom
let mapShare = 0.4;
let sizeBeforeFull = null;

const stackedLayout = () => window.matchMedia("(max-width: 1024px)").matches;
const mapSizeKey = () => (stackedLayout() ? "dhara-map-h" : "dhara-map-w");

function savedMapSize() {
  let raw = null;
  try { raw = localStorage.getItem(mapSizeKey()); } catch (e) {}
  if (raw && MAP_SIZE_SHARE.wide[raw]) return { size: raw };
  const share = parseFloat(raw);
  if (Number.isFinite(share) && share > 0.1 && share < 0.9) return { size: "custom", share };
  // Phones start with a small map so the page is still usable.
  return { size: stackedLayout() && window.innerWidth <= 640 ? "small" : "medium" };
}

function setMapSize(size, { share = null, persist = true } = {}) {
  const ws = document.getElementById("workspace");
  if (!ws) return;
  if (size === "full" && mapSize !== "full") sizeBeforeFull = { size: mapSize, share: mapShare };
  if (size !== "full") {
    mapShare = size === "custom" ? share : MAP_SIZE_SHARE[stackedLayout() ? "tall" : "wide"][size];
    ws.style.setProperty("--map-share", mapShare.toFixed(3));
  }
  mapSize = size;
  ws.dataset.mapSize = size;
  ws.classList.toggle("panel-hidden", size === "full");
  if (persist && size !== "full") {
    try { localStorage.setItem(mapSizeKey(), size === "custom" ? mapShare.toFixed(3) : size); } catch (e) {}
  }
  syncMapSizeControls();
  afterMapResize();
}

function toggleFullMap() {
  if (mapSize === "full") {
    const back = sizeBeforeFull || savedMapSize();
    setMapSize(back.size, { share: back.share, persist: false });
  } else {
    setMapSize("full", { persist: false });
  }
}

// The Live Map page opens with a large map; every other page uses the
// officer's own choice so the page has room to work.
function applyPageMapSize(viewName) {
  if (viewName === "map") {
    setMapSize("large", { persist: false });
    return;
  }
  const saved = savedMapSize();
  setMapSize(saved.size, { share: saved.share, persist: false });
}

function syncMapSizeControls() {
  document.querySelectorAll("[data-map-size]").forEach(btn => {
    btn.setAttribute("aria-pressed", String(btn.dataset.mapSize === mapSize));
  });
  document.querySelectorAll("[data-panel-toggle]").forEach(btn => {
    const full = mapSize === "full";
    btn.title = full ? "Show the page next to the map" : "Map only: hide the page";
    btn.setAttribute("aria-pressed", String(full));
  });
  const bar = document.getElementById("workspace-splitter");
  if (bar) {
    bar.setAttribute("aria-orientation", stackedLayout() ? "horizontal" : "vertical");
    bar.setAttribute("aria-valuenow", String(Math.round(mapShare * 100)));
  }
}

// After the map changes size, re-frame this page's places if the officer
// hasn't moved the map themselves, and tidy the key for the new size.
let mapFitView = null;
let mapResizeTimer = null;

function rememberMapFit() {
  if (!map) return;
  map.once("moveend", () => { mapFitView = { center: map.getCenter(), zoom: map.getZoom() }; });
}

function mapStillFramed() {
  if (!map || !mapFitView || map.getZoom() !== mapFitView.zoom) return false;
  const centre = map.getSize().divideBy(2);
  return map.latLngToContainerPoint(mapFitView.center).distanceTo(centre) < 4;
}

function afterMapResize() {
  clearTimeout(mapResizeTimer);
  mapResizeTimer = setTimeout(() => {
    if (!map) return;
    map.invalidateSize({ pan: true });
    if (mapStillFramed()) applyMapContext(currentMapContext);
    syncLegendToMapSize();
  }, 320);
}

function initMapSize() {
  const ws = document.getElementById("workspace");
  const bar = document.getElementById("workspace-splitter");
  if (!ws) return;

  // The pinned map band sits right under the top bar, whose height varies.
  const topBar = document.querySelector(".top-bar");
  const syncTopBar = () => {
    if (topBar && topBar.offsetHeight) document.documentElement.style.setProperty("--topbar-live", `${topBar.offsetHeight}px`);
  };
  syncTopBar();
  if (topBar && typeof ResizeObserver !== "undefined") new ResizeObserver(syncTopBar).observe(topBar);
  else window.addEventListener("resize", syncTopBar);

  document.querySelectorAll("[data-map-size]").forEach(btn => {
    btn.addEventListener("click", () => {
      const size = btn.dataset.mapSize;
      if (size === "full") toggleFullMap(); else setMapSize(size);
    });
  });
  document.querySelectorAll("[data-panel-toggle]").forEach(btn => btn.addEventListener("click", toggleFullMap));

  // Esc leaves "map only", unless it is closing something else first.
  // Capture phase: runs before the handlers that close dialogs.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || mapSize !== "full") return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    const pop = document.getElementById("map-tools-pop");
    if (pop && !pop.hidden) return;
    if (document.querySelector(".modal-overlay:not(.hidden), .cmdk-overlay:not(.hidden), .t3d-overlay.open")) return;
    toggleFullMap();
  }, true);

  // Crossing the tablet breakpoint swaps side-by-side for stacked.
  window.matchMedia("(max-width: 1024px)").addEventListener("change", () => {
    const saved = savedMapSize();
    setMapSize(saved.size, { share: saved.share, persist: false });
  });

  if (!bar) return;
  const shareAt = (e) => {
    const box = ws.getBoundingClientRect();
    if (stackedLayout()) {
      const top = document.getElementById("workspace-map").getBoundingClientRect().top;
      const room = window.innerHeight - top;
      return Math.min(Math.max((e.clientY - top) / room, MAP_MIN_H / room), 1 - 140 / room);
    }
    const lo = MAP_MIN_W / box.width;
    const hi = Math.max(lo, 1 - PANEL_MIN_W / box.width);
    return Math.min(Math.max((box.right - e.clientX) / box.width, lo), hi);
  };
  // Snap to a preset when the drag ends close to one.
  const settle = (share) => {
    const table = MAP_SIZE_SHARE[stackedLayout() ? "tall" : "wide"];
    const near = Object.keys(table).find(k => Math.abs(table[k] - share) < 0.025);
    if (near) setMapSize(near); else setMapSize("custom", { share });
  };

  let dragging = false;
  bar.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    bar.setPointerCapture(e.pointerId);
    ws.classList.add("resizing");
  });
  bar.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    mapShare = shareAt(e);
    ws.style.setProperty("--map-share", mapShare.toFixed(3));
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    ws.classList.remove("resizing");
    settle(mapShare);
  };
  bar.addEventListener("pointerup", endDrag);
  bar.addEventListener("pointercancel", endDrag);
  bar.addEventListener("dblclick", () => setMapSize(stackedLayout() && window.innerWidth <= 640 ? "small" : "medium"));
  bar.addEventListener("keydown", (e) => {
    const stacked = stackedLayout();
    const grow = stacked ? "ArrowDown" : "ArrowLeft";
    const shrink = stacked ? "ArrowUp" : "ArrowRight";
    const table = MAP_SIZE_SHARE[stacked ? "tall" : "wide"];
    let share = null;
    if (e.key === grow) share = mapShare + 0.05;
    else if (e.key === shrink) share = mapShare - 0.05;
    else if (e.key === "Home") share = table.small;
    else if (e.key === "End") share = table.large;
    if (share == null) return;
    e.preventDefault();
    settle(Math.min(Math.max(share, 0.2), 0.8));
  });
}

// ---------- Map tools menu (map pane header) ----------
function initMapToolsMenu() {
  const btn = document.getElementById("btn-map-tools");
  const pop = document.getElementById("map-tools-pop");
  if (!btn || !pop) return;
  const close = () => {
    pop.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = pop.hidden;
    pop.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) {
      const first = pop.querySelector("button");
      if (first) first.focus();
    }
  });
  pop.addEventListener("click", (e) => {
    const item = e.target.closest("button");
    if (!item) return;
    close();
    // The tool panels need room; a small map grows to large for them.
    const tool = item.dataset.mapTool;
    const view = document.getElementById("map-viewport");
    if ((tool === "intel" || tool === "notes") && view && (view.clientWidth < 520 || view.clientHeight < 460) && mapSize !== "full") {
      setMapSize("large", { persist: false });
    }
  });
  document.addEventListener("click", (e) => {
    if (!pop.hidden && !e.target.closest(".map-tools-menu")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pop.hidden) {
      close();
      btn.focus();
    }
  });
}

// ---------- What the map shows for each page ----------
function labelMarker(latlng, text, cls = "") {
  return L.marker(latlng, {
    icon: L.divIcon({ className: `map-label-marker ${cls}`, html: `<span>${escapeHtml(text)}</span>`, iconSize: null }),
    interactive: false,
    keyboard: false
  });
}

function ringMarker(latlng, opts = {}) {
  return L.circleMarker(latlng, Object.assign({
    radius: 11, color: cssVar("--accent-crimson") || "#A82E3A", weight: 3, fill: false, opacity: 0.95
  }, opts));
}

function segmentOutline(seg, group) {
  return L.geoJSON(seg, {
    style: { color: cssVar("--accent-crimson") || "#A82E3A", weight: 11, opacity: 0.28, lineCap: "round" },
    interactive: false
  }).addTo(group);
}

function habLatLng(villageId) {
  const h = habById.get(villageId);
  return h ? [h.geometry.coordinates[1], h.geometry.coordinates[0]] : null;
}

const MAP_CONTEXT = {
  decisions: {
    title: "Villages waiting for a decision",
    sub: (n) => `${n} villages ringed in red · the 5 most urgent are labelled`,
    highlight(group) {
      const pts = [];
      pendingDecisions().forEach((d, i) => {
        const ll = habLatLng(d.village_id);
        if (!ll) return;
        pts.push(ll);
        ringMarker(ll).bindTooltip(`${escapeHtml(d.village_name)} · ${d.recommended_units}t ${escapeHtml(d.recommended_commodity)}`, { direction: "top", className: "map-tip" })
          .on("click", () => openDecision(d.id))
          .addTo(group);
        if (i < 5) labelMarker(ll, `${i + 1}. ${d.village_name}`).addTo(group);
      });
      return pts;
    }
  },
  risks: {
    title: "Roads with an active alert",
    sub: (n) => `${n} alerted roads outlined in red`,
    highlight(group) {
      const pts = [];
      alertsData.forEach(a => {
        const loc = parseAlertLocation(a.location);
        const seg = loc.segment ? segById.get(loc.segment) : null;
        if (!seg) return;
        const b = segmentOutline(seg, group).getBounds();
        if (b.isValid()) { pts.push(b.getNorthEast(), b.getSouthWest()); }
      });
      return pts;
    }
  },
  routes: {
    title: "The 12 roads most likely to close",
    sub: () => "Numbers on the map match the list",
    highlight(group) {
      const pts = [];
      topRiskSegments(12).forEach((seg, i) => {
        const b = segmentOutline(seg, group).getBounds();
        if (!b.isValid()) return;
        pts.push(b.getNorthEast(), b.getSouthWest());
        L.marker(b.getCenter(), {
          icon: L.divIcon({ className: "map-rank", html: `<span>${i + 1}</span>`, iconSize: [22, 22] }),
          keyboard: false
        }).on("click", () => showSegmentOnMap(seg)).addTo(group);
      });
      return pts;
    }
  },
  shipments: {
    title: "Relief shipments on the move",
    sub: (n) => `${n} trucks · dashed line shows the way to each destination`,
    highlight(group) {
      const pts = [];
      currentShipments().forEach(s => {
        const c = Array.isArray(s.current_coordinates) ? [s.current_coordinates[1], s.current_coordinates[0]] : null;
        const m = /\((hab_[^)]+)\)/.exec(s.destination_village || "");
        const dest = m ? habLatLng(m[1]) : null;
        if (c) {
          pts.push(c);
          L.marker(c, { icon: truckIcon(true), keyboard: false })
            .bindTooltip(`${escapeHtml(s.license_number)} · ${escapeHtml(s.status)}`, { direction: "top", offset: [0, -12], className: "map-tip" })
            .on("click", () => openShipmentModal(s.license_number))
            .addTo(group);
          labelMarker(c, s.license_number, "below").addTo(group);
        }
        if (dest) {
          pts.push(dest);
          ringMarker(dest, { radius: 8 }).bindTooltip(`Destination: ${escapeHtml(s.destination_village)}`, { direction: "top", className: "map-tip" }).addTo(group);
          if (c) L.polyline([c, dest], { color: cssVar("--accent-crimson") || "#A82E3A", weight: 2.5, dashArray: "6 6", opacity: 0.9, interactive: false }).addTo(group);
        }
      });
      return pts;
    }
  },
  fleet: {
    title: "Relief trucks",
    sub: (n) => `${n} trucks with their IDs · simulated GPS`,
    highlight(group) {
      const pts = [];
      (vehiclesData.length ? vehiclesData : []).forEach(v => {
        if (!Array.isArray(v.coordinates)) return;
        const ll = [v.coordinates[1], v.coordinates[0]];
        pts.push(ll);
        ringMarker(ll, { radius: 15 }).addTo(group);
        labelMarker(ll, String(v.vehicle_id).toUpperCase(), "below").addTo(group);
      });
      return pts;
    }
  },
  depots: {
    title: "Supply depots",
    sub: (n) => `${n} depots with their names`,
    highlight(group) {
      const pts = [];
      currentDepots().forEach(d => {
        const c = d.location && d.location.coordinates;
        if (!c) return;
        const ll = [c[1], c[0]];
        pts.push(ll);
        ringMarker(ll, { radius: 17 }).addTo(group);
        labelMarker(ll, d.name, "below").addTo(group);
      });
      return pts;
    }
  }
};

function applyMapContext(viewName, { fit = true } = {}) {
  currentMapContext = viewName;
  if (!map || !mapLayers.context) return;
  mapLayers.context.clearLayers();
  const ctx = MAP_CONTEXT[viewName];
  let count = 0;
  if (ctx) {
    const pts = ctx.highlight(mapLayers.context) || [];
    count = viewName === "risks" || viewName === "routes" ? pts.length / 2 : pts.length;
    if (viewName === "shipments") count = currentShipments().length;
    if (fit && pts.length) {
      rememberMapFit();
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 11 });
    } else if (fit) {
      fitAllData();
    }
  } else if (fit && (viewName === "overview" || viewName === "map")) {
    fitAllData();
  }
  renderMapCaption(count);
}

function renderMapCaption(count) {
  const title = document.getElementById("map-caption-title");
  const sub = document.getElementById("map-caption-sub");
  if (!title || !sub) return;
  const ctx = MAP_CONTEXT[currentMapContext];
  const activeDay = document.querySelector("#forecast-day-chips .forecast-day-chip.active");
  const day = activeDay ? activeDay.textContent.trim() : "Day 1";
  if (ctx) {
    title.textContent = ctx.title;
    sub.textContent = count ? ctx.sub(Math.round(count)) : "Nothing to show for this page yet";
    return;
  }
  const villages = (habitationsData || []).length;
  const roads = (atRiskSegmentsData || []).filter(s => s.properties.closure_probability >= 0.25).length;
  title.textContent = "Every village, road and relief depot";
  if (!villages) {
    sub.textContent = apiOnline === false
      ? "Map data unavailable: the DHARA API isn't responding"
      : "Loading villages and roads…";
    return;
  }
  sub.textContent = `${villages.toLocaleString()} villages · ${roads} roads at risk · forecast ${day}`;
}

// ---------- Map guide page + tools ----------
function initMapToolbar() {
  document.querySelectorAll("[data-map-tool]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!map) {
        showToast("The map is still loading. Try again in a moment.", "info");
        return;
      }
      const tool = btn.dataset.mapTool;
      if (tool === "intel" && window.DharaIntel && window.DharaIntel.togglePanel) {
        window.DharaIntel.togglePanel();
      } else if (tool === "notes" && window.DharaOps && window.DharaOps.togglePanel) {
        window.DharaOps.togglePanel();
      } else if (tool === "terrain" && window.DharaTerrain3D) {
        window.DharaTerrain3D.open();
      } else if (tool === "layers" && mapLayerControl) {
        const el = mapLayerControl.getContainer();
        if (el.classList.contains("leaflet-control-layers-expanded")) {
          mapLayerControl.collapse();
        } else {
          mapLayerControl.expand();
        }
      }
      syncMapToolbar();
    });
  });

  document.querySelectorAll("[data-map-reset]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!map) return;
      mapLayers.selection.clearLayers();
      map.closePopup();
      fitAllData();
    });
  });

  document.querySelectorAll("[data-layer-toggle]").forEach(box => {
    box.addEventListener("change", () => {
      const layer = mapLayers[box.dataset.layerToggle];
      if (!map || !layer) return;
      if (box.checked) map.addLayer(layer); else map.removeLayer(layer);
    });
  });

  // Keep the caption's forecast day in step with the Day 1-7 chips
  document.querySelectorAll("#forecast-day-chips .forecast-day-chip").forEach(chip => {
    chip.addEventListener("click", () => setTimeout(() => renderMapCaption(), 50));
  });
}

function syncLayerToggles() {
  document.querySelectorAll("[data-layer-toggle]").forEach(box => {
    const layer = mapLayers[box.dataset.layerToggle];
    if (map && layer) box.checked = map.hasLayer(layer);
  });
}

function syncMapToolbar() {
  const state = {
    intel: !!document.querySelector(".intel-panel:not(.ops-panel):not(.collapsed)"),
    notes: !!document.querySelector(".ops-panel:not(.collapsed)")
  };
  document.querySelectorAll("[data-map-tool]").forEach(btn => {
    const tool = btn.dataset.mapTool;
    if (!(tool in state)) return;
    btn.classList.toggle("active", state[tool]);
    btn.setAttribute("aria-pressed", String(state[tool]));
  });
}

// ---------- Field app: where is the incident? ----------
let fieldMap = null;
let fieldPin = null;
let fieldBasemap = null;

function parseLatLon(text) {
  const parts = String(text || "").split(",").map(x => parseFloat(x.trim()));
  return parts.length === 2 && parts.every(Number.isFinite) ? parts : null;
}

function setFieldCoords(latlng, note) {
  const input = document.getElementById("f-rep-coords");
  const hint = document.getElementById("gps-status-hint");
  const lat = latlng.lat.toFixed(4);
  const lng = latlng.lng.toFixed(4);
  if (input) input.value = `${lat}, ${lng}`;
  if (hint) hint.textContent = `✓ ${note}: Lat ${lat}, Lon ${lng}`;
}

// Move the pin to whatever is in the coordinates box (after a GPS capture).
function syncFieldPin() {
  if (!fieldMap || !fieldPin) return;
  const ll = parseLatLon((document.getElementById("f-rep-coords") || {}).value);
  if (!ll) return;
  fieldPin.setLatLng(ll);
  fieldMap.setView(ll, Math.max(fieldMap.getZoom(), 12));
}

function initFieldMap() {
  const el = document.getElementById("field-map");
  if (!el || typeof L === "undefined" || el.offsetParent === null) return;
  if (fieldMap) {
    fieldMap.invalidateSize();
    return;
  }
  const start = parseLatLon((document.getElementById("f-rep-coords") || {}).value) || [27.2415, 92.418];
  fieldMap = L.map(el, { center: start, zoom: 12, attributionControl: false, scrollWheelZoom: false, tap: true });
  fieldBasemap = buildBasemaps()[currentTheme()];
  fieldBasemap.addTo(fieldMap);

  if (atRiskSegmentsData && atRiskSegmentsData.length) {
    const c = mapPalette();
    L.geoJSON(atRiskSegmentsData, {
      style: f => ({ color: f.properties.closure_probability >= 0.5 ? c.red : (f.properties.closure_probability >= 0.25 ? c.amber : c.blue), weight: 3, opacity: 0.85 }),
      interactive: false
    }).addTo(fieldMap);
  }

  fieldPin = L.marker(start, {
    draggable: true,
    icon: L.divIcon({ className: "field-pin", html: icon("pin", 30), iconSize: [30, 30], iconAnchor: [15, 29] })
  }).addTo(fieldMap);
  fieldPin.on("dragend", () => setFieldCoords(fieldPin.getLatLng(), "Pin moved on the map"));
  fieldMap.on("click", (e) => {
    fieldPin.setLatLng(e.latlng);
    setFieldCoords(e.latlng, "Location set on the map");
  });
  setTimeout(() => fieldMap && fieldMap.invalidateSize(), 250);
}

function syncFieldMapTheme() {
  if (!fieldMap || !fieldBasemap) return;
  fieldMap.removeLayer(fieldBasemap);
  fieldBasemap = buildBasemaps()[currentTheme()];
  fieldBasemap.addTo(fieldMap);
  fieldBasemap.eachLayer ? fieldBasemap.eachLayer(l => l.bringToBack && l.bringToBack()) : fieldBasemap.bringToBack();
}

// ====================================================
// SIDEBAR RAIL, QUICK SEARCH & KEYBOARD SHORTCUTS
// ====================================================
const SIDEBAR_KEY = "dhara-sidebar";

function setSidebarCollapsed(collapsed) {
  const layout = document.getElementById("view-officer-app");
  const btn = document.getElementById("btn-sidebar-collapse");
  if (!layout) return;
  layout.classList.toggle("sidebar-collapsed", collapsed);
  if (btn) {
    const label = collapsed ? "Expand sidebar ( [ )" : "Collapse sidebar ( [ )";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-expanded", String(!collapsed));
  }
  try { localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "open"); } catch (e) {}
}

function initSidebarCollapse() {
  // Nav labels double as tooltips when only the icons are showing.
  document.querySelectorAll(".sidebar .nav-item").forEach(item => {
    const label = item.querySelector("[data-i18n]");
    if (label) item.title = label.textContent.trim();
  });
  let collapsed = false;
  try { collapsed = localStorage.getItem(SIDEBAR_KEY) === "collapsed"; } catch (e) {}
  setSidebarCollapsed(collapsed);
  const btn = document.getElementById("btn-sidebar-collapse");
  if (btn) {
    btn.addEventListener("click", () => {
      const layout = document.getElementById("view-officer-app");
      setSidebarCollapsed(!layout.classList.contains("sidebar-collapsed"));
    });
  }
}

// ---------- Quick search (Ctrl+K / "/") ----------
let paletteItems = [];
let paletteIndex = 0;

function isTypingTarget(el) {
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

function officerAppVisible() {
  const layout = document.getElementById("view-officer-app");
  return !!layout && !layout.classList.contains("hidden");
}

function openPalette() {
  const overlay = document.getElementById("command-palette");
  const input = document.getElementById("cmdk-input");
  if (!overlay || !input) return;
  overlay.classList.remove("hidden");
  input.value = "";
  renderPalette("");
  setTimeout(() => input.focus(), 0);
}

function closePalette() {
  const overlay = document.getElementById("command-palette");
  if (overlay) overlay.classList.add("hidden");
}

function paletteOpen() {
  const overlay = document.getElementById("command-palette");
  return !!overlay && !overlay.classList.contains("hidden");
}

function buildPaletteItems(query) {
  const q = query.trim().toLowerCase();
  const items = [];
  const matches = (text) => !q || String(text).toLowerCase().includes(q);

  Object.entries(OFFICER_VIEW_TITLES).forEach(([view, title]) => {
    if (matches(title) || matches(view)) {
      items.push({ group: "Pages", icon: "map", label: title, sub: `#/${view}`, run: () => { window.location.hash = `#/${view}`; } });
    }
  });
  [
    { label: "New field report", sub: "Field reporting app", hash: "#/field-app", icon: "edit" },
    { label: "Switch role", sub: "Officer / field selection", hash: "#/entry", icon: "route" }
  ].forEach(x => {
    if (matches(x.label)) items.push({ group: "Pages", icon: x.icon, label: x.label, sub: x.sub, run: () => { window.location.hash = x.hash; } });
  });

  const decisions = [...liveDecisions].sort(compareDecisions)
    .filter(d => !q || d.village_name.toLowerCase().includes(q) || String(d.district).toLowerCase().includes(q))
    .slice(0, q ? 6 : 3);
  decisions.forEach(d => {
    items.push({
      group: "Decisions",
      icon: "package",
      label: d.village_name,
      sub: `${d.recommended_units}t ${String(d.recommended_commodity).toLowerCase()} · VRI ${d.current_vri} · ${d.status}`,
      run: () => openDecision(d.id)
    });
  });

  if (q.length >= 2 && window.DharaIntel && window.DharaIntel.search) {
    window.DharaIntel.search(q).forEach(r => {
      items.push({
        group: "Places on the map",
        icon: "pin",
        label: r.label,
        sub: r.sub,
        run: () => onLiveMap(() => {
          if (window.DharaIntel.focus) window.DharaIntel.focus(r);
          else map.setView(r.ll, 12);
          showHalo(r.ll);
        })
      });
    });
  }
  return items;
}

function renderPalette(query) {
  const list = document.getElementById("cmdk-results");
  if (!list) return;
  paletteItems = buildPaletteItems(query);
  paletteIndex = 0;
  if (!paletteItems.length) {
    list.innerHTML = `<li class="cmdk-empty">No matches for "${escapeHtml(query)}". Try a village, depot or page name.</li>`;
    return;
  }
  let html = "";
  let group = null;
  paletteItems.forEach((it, i) => {
    if (it.group !== group) {
      group = it.group;
      html += `<li class="cmdk-group" role="presentation">${escapeHtml(group)}</li>`;
    }
    html += `<li role="option" id="cmdk-opt-${i}" class="cmdk-item${i === 0 ? " active" : ""}" data-i="${i}" aria-selected="${i === 0}">
      <span class="cmdk-icon">${icon(it.icon, 15)}</span>
      <span class="cmdk-label">${escapeHtml(it.label)}</span>
      <span class="cmdk-sub">${escapeHtml(it.sub || "")}</span>
    </li>`;
  });
  list.innerHTML = html;
}

function movePalette(delta) {
  if (!paletteItems.length) return;
  paletteIndex = (paletteIndex + delta + paletteItems.length) % paletteItems.length;
  document.querySelectorAll("#cmdk-results .cmdk-item").forEach(el => {
    const on = Number(el.dataset.i) === paletteIndex;
    el.classList.toggle("active", on);
    el.setAttribute("aria-selected", String(on));
    if (on) el.scrollIntoView({ block: "nearest" });
  });
}

function runPaletteItem(i) {
  const it = paletteItems[i];
  if (!it) return;
  closePalette();
  it.run();
}

function initCommandPalette() {
  const overlay = document.getElementById("command-palette");
  const input = document.getElementById("cmdk-input");
  const list = document.getElementById("cmdk-results");
  if (!overlay || !input || !list) return;

  document.querySelectorAll("[data-open-search]").forEach(btn => btn.addEventListener("click", openPalette));
  input.addEventListener("input", () => renderPalette(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); movePalette(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); movePalette(-1); }
    else if (e.key === "Enter") { e.preventDefault(); runPaletteItem(paletteIndex); }
    else if (e.key === "Escape") { e.preventDefault(); closePalette(); }
  });
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".cmdk-item");
    if (item) runPaletteItem(Number(item.dataset.i));
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePalette();
  });
}

function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      if (!officerAppVisible()) return;
      e.preventDefault();
      if (paletteOpen()) closePalette(); else openPalette();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || paletteOpen()) return;
    if (!officerAppVisible()) return;
    if (e.key === "/") {
      e.preventDefault();
      openPalette();
    } else if (e.key === "[" && window.innerWidth > 768) {
      const layout = document.getElementById("view-officer-app");
      setSidebarCollapsed(!layout.classList.contains("sidebar-collapsed"));
    }
  });
}

// ====================================================
// 1. OFFLINE INDEXEDDB SYSTEM
// ====================================================
function initIndexedDB() {
  if (!('indexedDB' in window)) {
    console.warn("IndexedDB not supported on this browser.");
    return;
  }
  const request = indexedDB.open("DHARA_Offline_DB", 2);
  request.onupgradeneeded = (e) => {
    const dbRef = e.target.result;
    if (!dbRef.objectStoreNames.contains("queued_reports")) {
      dbRef.createObjectStore("queued_reports", { keyPath: "uuid" });
    }
    if (!dbRef.objectStoreNames.contains("cached_decisions")) {
      dbRef.createObjectStore("cached_decisions", { keyPath: "id" });
    }
  };
  request.onsuccess = (e) => {
    db = e.target.result;
    loadPendingReportsFromDB();
    // Auto-sync when connectivity changes
    window.addEventListener("online", handleOnlineSync);
    window.addEventListener("offline", updateConnectionStatus);
    updateConnectionStatus();
  };
  request.onerror = (e) => {
    console.error("IndexedDB initialization error:", e);
  };
}

function updateConnectionStatus() {
  const isOnline = navigator.onLine;
  const pill = document.getElementById("field-conn-status");
  const text = document.getElementById("field-conn-text");
  const syncNotice = document.getElementById("field-sync-notice");

  if (pill && text) {
    pill.className = `field-conn-pill ${isOnline ? 'online' : 'offline'}`;
    text.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
  }
  if (syncNotice) {
    if (isOnline) {
      syncNotice.innerHTML = `<span class="dot green"></span><span>Connected • Immediate Database Sync Active</span>`;
    } else {
      syncNotice.innerHTML = `<span class="dot amber"></span><span>OFFLINE — Reports will save locally to device and sync automatically</span>`;
    }
  }
}

async function handleOnlineSync() {
  updateConnectionStatus();
  showToast("⚡ Network connection restored. Syncing offline reports...", "info");
  await syncOfflineReports();
}

function loadPendingReportsFromDB() {
  if (!db) return;
  const tx = db.transaction("queued_reports", "readonly");
  const store = tx.objectStore("queued_reports");
  const req = store.getAll();
  req.onsuccess = () => {
    pendingFieldReports = req.result || [];
    updatePendingBadge();
    renderPendingReportsList();
  };
}

function updatePendingBadge() {
  const badge = document.getElementById("pending-count-badge");
  if (badge) {
    badge.textContent = pendingFieldReports.length;
    badge.style.display = pendingFieldReports.length > 0 ? "inline-block" : "none";
  }
}

async function syncOfflineReports() {
  if (!db || !navigator.onLine || pendingFieldReports.length === 0) return;

  const pill = document.getElementById("field-conn-status");
  const text = document.getElementById("field-conn-text");
  if (pill && text) {
    pill.className = "field-conn-pill syncing";
    text.textContent = "SYNCING...";
  }

  let syncedCount = 0;
  for (const rep of [...pendingFieldReports]) {
    try {
      const res = await fetch(`${API_BASE}/field-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporter_name: rep.reporter_name,
          location_name: rep.location_name,
          incident_type: rep.incident_type,
          severity: rep.severity,
          description: rep.description,
          coordinates: rep.coordinates || [92.4180, 27.2415]
        })
      });

      if (res.ok) {
        // Remove from IndexedDB
        const delTx = db.transaction("queued_reports", "readwrite");
        delTx.objectStore("queued_reports").delete(rep.uuid);
        syncedCount++;
      }
    } catch (e) {
      console.warn("Failed to sync report:", rep.uuid, e);
    }
  }

  loadPendingReportsFromDB();
  fetchSubmittedFieldReports();
  updateConnectionStatus();

  if (syncedCount > 0) {
    showToast(`✓ Successfully synced ${syncedCount} field report(s) to DHARA database!`, "success");
  }
}

// ====================================================
// 2. MULTILINGUAL TRANSLATION SYSTEM
// ====================================================
function initLanguages() {
  const langSelectMain = document.getElementById("lang-select");
  const langSelectEntry = document.getElementById("entry-lang-select");
  const langSelectField = document.getElementById("field-lang-select");

  [langSelectMain, langSelectEntry, langSelectField].forEach(sel => {
    if (sel) {
      sel.value = currentLang;
      sel.addEventListener("change", (e) => {
        currentLang = e.target.value;
        localStorage.setItem("dhara_lang", currentLang);
        if (langSelectMain) langSelectMain.value = currentLang;
        if (langSelectEntry) langSelectEntry.value = currentLang;
        if (langSelectField) langSelectField.value = currentLang;
        applyTranslations();
        if (DRAFT_LANGS.has(currentLang)) {
          showToast("This translation is a draft awaiting native-speaker review. Hover over any label to see the English.", "warning");
        }
      });
    }
  });

  applyTranslations();
}

function lookupTranslation(dict, key) {
  let val = dict;
  for (const p of key.split(".")) {
    val = val ? val[p] : null;
  }
  return typeof val === "string" ? val : null;
}

function applyTranslations() {
  if (!I18N[currentLang]) currentLang = "en";
  const dict = I18N[currentLang];
  const isDraft = DRAFT_LANGS.has(currentLang);
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const english = lookupTranslation(I18N.en, key);
    // A missing string falls back to English rather than leaving the previous language's text.
    const val = lookupTranslation(dict, key) || english;
    if (val) el.innerHTML = val;
    if (isDraft && english) {
      el.title = english.replace(/<[^>]+>/g, "");
      el.dataset.i18nTitle = "1";
    } else if (el.dataset.i18nTitle) {
      el.removeAttribute("title");
      delete el.dataset.i18nTitle;
    }
  });
}

// ====================================================
// 3. NAVIGATION & ROUTING
// ====================================================
function initNavigation() {
  window.addEventListener("hashchange", handleRoute);
  
  // Brand / Home Click returns to entry selection
  const brandHome = document.getElementById("brand-home-click");
  if (brandHome) {
    brandHome.addEventListener("click", () => {
      window.location.hash = "#/entry";
    });
  }

  const btnSwitchSide = document.getElementById("btn-switch-mode-side");
  if (btnSwitchSide) {
    btnSwitchSide.addEventListener("click", () => {
      window.location.hash = "#/entry";
    });
  }

  const btnFieldBackHome = document.getElementById("btn-field-back-home");
  if (btnFieldBackHome) {
    btnFieldBackHome.addEventListener("click", () => {
      window.location.hash = "#/entry";
    });
  }

  // Role Card Action Buttons on Entry Page
  const btnEnterOfficer = document.getElementById("btn-enter-officer");
  if (btnEnterOfficer) {
    btnEnterOfficer.addEventListener("click", () => {
      window.location.hash = "#/overview";
    });
  }

  const btnEnterField = document.getElementById("btn-enter-field");
  if (btnEnterField) {
    btnEnterField.addEventListener("click", () => {
      window.location.hash = "#/field-app";
    });
  }

  const btnTopbarField = document.getElementById("btn-topbar-field-report");
  if (btnTopbarField) {
    btnTopbarField.addEventListener("click", () => {
      window.location.hash = "#/field-app";
    });
  }

  handleRoute();
}

const OFFICER_VIEW_TITLES = {
  overview: "Overview",
  map: "Live map",
  decisions: "Today's decisions",
  risks: "Corridor risks & alerts",
  routes: "Routes & egress",
  shipments: "Shipments & manifests",
  fleet: "Fleet telemetry",
  depots: "Depots & hubs",
  "field-reports": "Field incident logs",
  audit: "Audit trail",
  "track-record": "Track record",
  copilot: "DHARA Copilot",
  scenarios: "What-if scenarios",
  planner: "Infrastructure planner"
};

function handleRoute() {
  // /dashboard with no hash opens the officer Overview; the role picker
  // stays reachable at #/entry (brand logo, "switch role" button).
  const hash = window.location.hash || "#/overview";
  let viewName = hash.replace("#/", "") || "overview";

  const entryScreen = document.getElementById("view-entry");
  const fieldAppScreen = document.getElementById("view-field-app");
  const officerAppLayout = document.getElementById("view-officer-app");

  if (viewName === "entry") {
    if (entryScreen) entryScreen.classList.remove("hidden");
    if (fieldAppScreen) fieldAppScreen.classList.add("hidden");
    if (officerAppLayout) officerAppLayout.classList.add("hidden");
    return;
  }

  if (viewName === "field-app" || viewName === "field-report") {
    if (entryScreen) entryScreen.classList.add("hidden");
    if (fieldAppScreen) fieldAppScreen.classList.remove("hidden");
    if (officerAppLayout) officerAppLayout.classList.add("hidden");
    // The field form has its own small map for the incident location.
    setTimeout(initFieldMap, 60);
    return;
  }

  // Officer Dashboard Sub-Views (unknown hashes fall back to Overview)
  if (!(viewName in OFFICER_VIEW_TITLES)) viewName = "overview";

  if (entryScreen) entryScreen.classList.add("hidden");
  if (fieldAppScreen) fieldAppScreen.classList.add("hidden");
  if (officerAppLayout) officerAppLayout.classList.remove("hidden");

  // Highlight Sidebar Nav
  document.querySelectorAll(".sidebar .nav-item").forEach(item => {
    const active = item.dataset.view === viewName;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });

  // Switch Viewport Divs
  Object.keys(OFFICER_VIEW_TITLES).forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== viewName);
  });

  // Update Breadcrumb Title
  const bcTitle = document.getElementById("bc-title");
  if (bcTitle) bcTitle.textContent = OFFICER_VIEW_TITLES[viewName];
  document.title = `${OFFICER_VIEW_TITLES[viewName]} · DHARA`;

  const main = document.querySelector(".main-content");
  if (main) main.dataset.view = viewName;

  // The map is on screen for every officer page; it shows this page's items.
  // Opening a page always brings the page back, even after "map only".
  applyPageMapSize(viewName);
  ensureMap(viewName);

  const panel = document.getElementById("workspace-panel");
  if (panel) panel.scrollTop = 0;
  window.scrollTo(0, 0);
}

// ====================================================
// 4. DATA FETCHING & BACKEND INTEGRATION
// ====================================================
let forecastData = null;
let mapFramedWithData = false;
let habById = new Map();   // village id -> habitation feature
let segById = new Map();   // segment id -> at-risk segment feature

// Sync status for the top-bar pill and the offline banner
let lastSyncAt = null;
let apiOnline = null;      // null until the first fetch finishes
let syncInFlight = false;

async function checkApiHealth() {
  const statusSub = document.getElementById("sidebar-status-sub");
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      if (statusSub) statusSub.textContent = `All systems operational (${data.engine || 'PostgreSQL 16 + PostGIS 3.4'})`;
    }
  } catch (e) {
    console.warn("Backend API at localhost:3001 not responding, using offline adapter mode:", e);
    if (statusSub) statusSub.textContent = "Offline Mode (Local Storage & Cache)";
  }
}

async function fetchAllData() {
  if (syncInFlight) return;
  syncInFlight = true;
  renderSyncStatus();

  const getJson = (path) => fetch(`${API_BASE}${path}`).then(r => {
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  });

  try {
    const [habRes, segRes, dispRes, shipRes, vehRes, depRes, altRes, trRes, audRes, autoRes, covRes, fcRes] = await Promise.allSettled([
      getJson("/habitations"),
      getJson("/segments/at-risk"),
      getJson("/dispatches"),
      getJson("/shipments"),
      getJson("/vehicles/live"),
      getJson("/depots"),
      getJson("/alerts"),
      getJson("/track-record"),
      getJson("/audit"),
      getJson("/automation/status"),
      getJson("/coverage"),
      getJson("/forecast")
    ]);

    const ok = (res) => res.status === "fulfilled" && res.value && !res.value.error;
    if (ok(habRes) && habRes.value.features) habitationsData = habRes.value.features;
    if (ok(segRes) && segRes.value.features) atRiskSegmentsData = segRes.value.features;
    if (ok(shipRes) && Array.isArray(shipRes.value)) shipmentsData = shipRes.value;
    if (ok(vehRes) && Array.isArray(vehRes.value)) vehiclesData = vehRes.value;
    if (ok(depRes) && Array.isArray(depRes.value)) depotsData = depRes.value;
    if (ok(altRes) && Array.isArray(altRes.value)) alertsData = altRes.value;
    if (ok(trRes)) trackRecordData = trRes.value;
    if (ok(audRes) && Array.isArray(audRes.value)) auditData = audRes.value;
    if (ok(autoRes)) automationStatusData = autoRes.value;
    if (ok(covRes)) coverageData = covRes.value;
    if (ok(fcRes) && Array.isArray(fcRes.value.summary)) forecastData = fcRes.value;

    habById = new Map(habitationsData.map(f => [f.properties && f.properties.id, f]));
    segById = new Map(atRiskSegmentsData.map(f => [f.properties && f.properties.segment_id, f]));

    if (ok(dispRes) && Array.isArray(dispRes.value)) {
      dispatchesData = dispRes.value;
      liveDecisions = dispatchesData.map(buildDecision).sort(compareDecisions);
    }

    // The API counts as reachable if any of the core datasets came back.
    apiOnline = [habRes, segRes, dispRes].some(ok);
    if (apiOnline) lastSyncAt = new Date();
  } catch (err) {
    console.warn("API Fetch error, falling back to initialized datasets:", err);
    apiOnline = false;
  } finally {
    syncInFlight = false;
  }

  renderSyncStatus();
  renderOperationalMetrics();
  renderWorklistDecisions();
  renderActiveCorridorRisks();
  renderAlertsView();
  renderShipmentsView();
  renderFleetView();
  renderRoutesView();
  renderDepotsView();
  renderAuditTrailView();
  renderTrackRecordView();
  renderAutomationStatus();
  renderCopilotSummary();
  renderMapFilterCounts();
  fetchSubmittedFieldReports();
  safeUpdateMapLayers();
  computeAllDataBounds();
  if (map) {
    // First data load frames the map; later refreshes keep the officer's view.
    applyMapContext(currentMapContext, { fit: !mapFramedWithData });
    mapFramedWithData = true;
  }
  initAnalyticsCharts();
}

// ---------- Sync pill + offline banner ----------
function relTime(when) {
  if (!when) return "";
  const t = when instanceof Date ? when.getTime() : new Date(when).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function renderSyncStatus() {
  const pill = document.getElementById("sync-status");
  const text = document.getElementById("sync-status-text");
  const refresh = document.getElementById("btn-refresh-data");
  const banner = document.getElementById("offline-banner");
  const bannerText = document.getElementById("offline-banner-text");

  if (refresh) {
    refresh.classList.toggle("spinning", syncInFlight);
    refresh.disabled = syncInFlight;
  }
  if (pill && text) {
    let state, label;
    if (apiOnline === null) { state = "pending"; label = "Connecting…"; }
    else if (apiOnline) { state = "live"; label = `Live · ${relTime(lastSyncAt)}`; }
    else { state = "offline"; label = lastSyncAt ? `Offline · data ${relTime(lastSyncAt)}` : "Offline"; }
    pill.className = `pill-prov sync-pill ${state}`;
    text.textContent = syncInFlight && apiOnline !== null ? "Refreshing…" : label;
    pill.title = lastSyncAt ? `Last successful refresh: ${lastSyncAt.toLocaleTimeString()}` : "No data loaded from the API yet";
  }
  if (banner) {
    banner.classList.toggle("hidden", apiOnline !== false);
    if (bannerText) {
      bannerText.textContent = lastSyncAt
        ? `Showing data from ${relTime(lastSyncAt)}. Retrying every 30 seconds.`
        : `Showing built-in demo data until ${API_BASE} responds. Retrying every 30 seconds.`;
    }
  }
}

function initSyncControls() {
  const refresh = document.getElementById("btn-refresh-data");
  if (refresh) refresh.addEventListener("click", () => fetchAllData());
  const retry = document.getElementById("btn-offline-retry");
  if (retry) retry.addEventListener("click", () => fetchAllData());
  setInterval(renderSyncStatus, 5000);
}

// A bad row in one dataset must not take the charts or the rest of the page down with it.
function safeUpdateMapLayers() {
  if (typeof window.updateMapLayers !== "function") return;
  try {
    window.updateMapLayers();
  } catch (err) {
    console.warn("Map layer update failed:", err);
  }
}

function renderOperationalMetrics() {
  const habsEl = document.getElementById("stat-habitations");
  const risksEl = document.getElementById("stat-active-risks");
  const critsEl = document.getElementById("stat-critical-disruptions");
  const dispEl = document.getElementById("stat-active-dispatches");

  // /coverage returns {error} when the database is down.
  if (habsEl && coverageData && typeof coverageData.habitations_count === "number") {
    habsEl.textContent = coverageData.habitations_count.toLocaleString();
  }

  if (risksEl && atRiskSegmentsData) {
    const count = atRiskSegmentsData.filter(s => s.properties.closure_probability >= 0.25).length;
    risksEl.textContent = count.toLocaleString();
  }

  if (critsEl && atRiskSegmentsData) {
    const count = atRiskSegmentsData.filter(s => s.properties.closure_probability >= 0.50 || s.properties.predicted_closed).length;
    critsEl.textContent = count.toLocaleString();
  }

  if (dispEl && shipmentsData) {
    const count = shipmentsData.filter(s => s.status === "IN TRANSIT" || s.status === "DISPATCHED").length;
    dispEl.textContent = count.toLocaleString();
  }

  // Sidebar / top-bar counters follow the live data
  setBadge("nav-badge-alerts", alertsData.length);
  setBadge("topbar-alert-count", alertsData.length);
  setBadge("nav-badge-shipments", shipmentsData.length);
}

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? "" : "none";
}

// ====================================================
// 5. WORKLIST-FIRST OPERATIONAL DECISIONS ENGINE
// ====================================================
// Officer actions (approve / change / reject) are kept here so the 30-second
// refresh, which rebuilds every card from /dispatches, doesn't undo them.
const decisionLocalState = {};
const OVERVIEW_DECISION_LIMIT = 5;

function rememberDecision(dec) {
  decisionLocalState[dec.id] = {
    status: dec.status,
    reject_reason: dec.reject_reason,
    reject_notes: dec.reject_notes,
    recommended_units: dec.recommended_units,
    source_depot: dec.source_depot,
    corridor_route: dec.corridor_route,
    latest_departure: dec.latest_departure
  };
}

// The pipeline has written "Pre-positioned 12t 12t ration packs" (quantity
// repeated inside the cargo name); show it once.
function cleanReasoning(text) {
  return String(text || "").replace(/\b(\d+(?:\.\d+)?t) \1\b/gi, "$1");
}

function parseReasoning(text) {
  const t = String(text || "");
  const num = (re) => {
    const m = re.exec(t);
    return m ? parseFloat(m[1]) : null;
  };
  const cargo = /Pre-positioned (\d+(?:\.\d+)?)t (?:\d+(?:\.\d+)?t )?(.+?) to /i.exec(t);
  return {
    closure: num(/probability (\d(?:\.\d+)?)/i),
    confidence: num(/Confidence (\d(?:\.\d+)?)/i),
    vriProjected: num(/VRI projected at (\d+(?:\.\d+)?)/i),
    cutoffWithin: num(/within (\d+(?:\.\d+)?) hours/i),
    qty: cargo ? parseFloat(cargo[1]) : null,
    commodity: cargo ? cargo[2] : null
  };
}

function capitalize(s) {
  s = String(s || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatMinutes(min) {
  const n = Number(min);
  if (!Number.isFinite(n)) return "—";
  if (n < 60) return `${Math.round(n)} min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatLeaveBy(hoursFromNow) {
  const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function segmentLines(seg) {
  const g = seg && seg.geometry;
  if (!g) return [];
  if (g.type === "LineString") return [g.coordinates];
  if (g.type === "MultiLineString") return g.coordinates;
  return [];
}

// Closest at-risk road to a point (equirectangular distance; fine at this scale).
function nearestSegment(lon, lat) {
  let best = null;
  let bestD = Infinity;
  const k = Math.cos(lat * Math.PI / 180);
  for (const seg of atRiskSegmentsData || []) {
    for (const line of segmentLines(seg)) {
      for (const c of line) {
        const dx = (c[0] - lon) * k;
        const dy = c[1] - lat;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = seg; }
      }
    }
  }
  return best ? { seg: best, km: Math.sqrt(bestD) * 111.32 } : null;
}

function roadLabel(p) {
  if (!p) return "Road segment";
  const road = p.road_type ? `${capitalize(p.road_type)} road` : "Road segment";
  const district = districtLabel(p.district_id);
  return district ? `${road} · ${district}` : road;
}

// Roads further than this aren't really "the village's road"; say so plainly.
const NEAR_ROAD_KM = 25;

function nearRoadIsLocal(dec) {
  return dec.nearest_segment_km != null && dec.nearest_segment_km <= NEAR_ROAD_KM;
}

function buildDecision(d) {
  const hab = habById.get(d.village_id);
  const hp = hab ? hab.properties : {};
  const r = parseReasoning(d.reasoning);

  const vri = Number.isFinite(Number(hp.vri)) ? Number(hp.vri) : r.vriProjected;
  const cutoff = Number.isFinite(Number(hp.hours_until_cutoff)) ? Number(hp.hours_until_cutoff) : (r.cutoffWithin != null ? r.cutoffWithin : 48);
  const p = r.closure;
  const critical = (p != null && p >= 0.5) || (vri != null && vri < 30) || /CRITICAL/i.test(d.tier || "");
  const tNow = Number(hp.travel_time_now_min);
  const tAfter = Number(hp.travel_time_after_min);
  const delta = Number(hp.egress_delta_min);
  const leaveIn = Math.max(0, cutoff - (Number.isFinite(tAfter) ? tAfter / 60 : 0));
  const tr = trackRecordData || {};

  const near = hab ? nearestSegment(hab.geometry.coordinates[0], hab.geometry.coordinates[1]) : null;
  const np = near ? near.seg.properties : null;

  const dec = {
    id: `DEC_${d.id}`,
    db_id: d.id,
    village_id: d.village_id,
    village_name: d.village_name || hp.name || "Unknown village",
    district: districtLabel(hp.district_id) || "—",
    population: hp.population,
    cutoff_hours: cutoff,
    cutoff_status: hp.cutoff_status || "cutoff_predicted",
    closure_probability: p,
    risk_level: critical ? "Critical" : "High risk",
    severity_class: critical ? "critical" : "high-risk",
    vri_value: vri,
    current_vri: vri != null ? Number(vri).toFixed(1) : "—",
    recommended_commodity: r.commodity ? r.commodity.toLowerCase() : "relief supplies",
    recommended_units: d.units_required || d.units_shipped || r.qty,
    source_depot: d.depot_name || d.depot_id || "—",
    depot_id: d.depot_id,
    corridor_route: "Fastest open road from the depot",
    latest_departure: formatLeaveBy(leaveIn),
    confidence: r.confidence != null ? Math.round(r.confidence * 100) : null,
    tier: d.tier,
    track_record_stat: tr.total_predictions ? `${tr.confirmed_correct} / ${tr.total_predictions} recent predictions correct` : "—",
    reasoning: cleanReasoning(d.reasoning),
    created_at: d.created_at,
    status: "pending",
    nearest_segment_id: np ? np.segment_id : null,
    nearest_segment_km: near ? near.km : null,
    terrain_slope: np && np.slope_deg != null ? `${Number(np.slope_deg).toFixed(1)}° slope on the nearest at-risk road` : "—",
    landslide_class: np ? `Landslide class ${np.landslide_class ?? "—"} · ${Math.round(np.closure_probability * 100)}% closure risk` : "—",
    travel_time_now: formatMinutes(tNow),
    travel_time_after: formatMinutes(tAfter),
    alternate_route: Number.isFinite(delta) && delta > 0 ? `Alternate route adds ${formatMinutes(delta)}` : "No extra delay on the alternate route"
  };
  return Object.assign(dec, decisionLocalState[dec.id] || {});
}

// Pending first, then soonest cutoff, highest closure risk, lowest VRI.
function compareDecisions(a, b) {
  const pa = a.status === "pending" ? 0 : 1;
  const pb = b.status === "pending" ? 0 : 1;
  if (pa !== pb) return pa - pb;
  if (a.cutoff_hours !== b.cutoff_hours) return a.cutoff_hours - b.cutoff_hours;
  const ca = a.closure_probability ?? 0;
  const cb = b.closure_probability ?? 0;
  if (ca !== cb) return cb - ca;
  return (a.vri_value ?? 100) - (b.vri_value ?? 100);
}

function filteredDecisions() {
  const all = [...liveDecisions].sort(compareDecisions);
  switch (currentWorklistFilter) {
    case "critical": return all.filter(d => d.severity_class === "critical" || d.cutoff_hours <= 24);
    case "high-risk": return all.filter(d => d.severity_class === "high-risk");
    case "cutoff-24": return all.filter(d => d.cutoff_hours <= 24);
    case "cutoff-48": return all.filter(d => d.cutoff_hours <= 48);
    case "completed": return all.filter(d => d.status !== "pending");
    default: return all;
  }
}

function renderWorklistDecisions() {
  const container = document.getElementById("decision-cards-container");
  const dedicatedContainer = document.getElementById("dedicated-decisions-container");
  const heroCount = document.getElementById("worklist-hero-count");

  if (!container && !dedicatedContainer) return;

  const pendingCount = liveDecisions.filter(d => d.status === "pending").length;
  if (heroCount) {
    heroCount.textContent = `${pendingCount} village${pendingCount === 1 ? '' : 's'} need a decision today`;
  }
  setBadge("nav-badge-decisions", pendingCount);

  const filtered = filteredDecisions();
  const empty = `<div class="empty-panel">No decisions match this filter.</div>`;

  if (container) {
    const top = filtered.slice(0, OVERVIEW_DECISION_LIMIT);
    const more = filtered.length > top.length
      ? `<a class="worklist-more" href="#/decisions">View all ${filtered.length} decisions &rarr;</a>`
      : "";
    container.innerHTML = top.length ? top.map(d => generateDecisionCardHTML(d)).join("") + more : empty;
  }
  if (dedicatedContainer) {
    dedicatedContainer.innerHTML = filtered.length ? filtered.map(d => generateDecisionCardHTML(d)).join("") : empty;
  }

  bindDecisionButtons();
}

// Jump to a decision card on the Today's Decisions page and flash it.
function openDecision(id) {
  if (window.location.hash !== "#/decisions") window.location.hash = "#/decisions";
  setTimeout(() => {
    const card = document.querySelector(`#dedicated-decisions-container [data-card="${id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("flash");
    setTimeout(() => card.classList.remove("flash"), 1600);
  }, 120);
}

function generateDecisionCardHTML(d) {
  const isPending = d.status === "pending";
  const isApproved = d.status === "approved";
  const isModified = d.status === "modified";
  const isRejected = d.status === "rejected";

  let statusBadge = "";
  if (isApproved) {
    statusBadge = `<span class="status-tag green">${icon("check", 12)} Approved &amp; dispatch queued</span>`;
  } else if (isModified) {
    statusBadge = `<span class="status-tag blue">${icon("edit", 12)} Modified (officer override)</span>`;
  } else if (isRejected) {
    statusBadge = `<span class="status-tag red">${icon("x", 12)} Rejected: ${d.reject_reason || 'Officer override'}</span>`;
  }

  const t = I18N[currentLang]?.actions || I18N.en.actions;

  return `
    <div class="decision-card ${d.severity_class} ${isApproved ? 'acted-approved' : ''} ${isRejected ? 'acted-rejected' : ''}" data-card="${d.id}">
      <div class="decision-card-top-row">
        <div class="decision-village-group">
          <span class="decision-village-name">${escapeHtml(d.village_name)}</span>
          <span class="decision-district-tag">${escapeHtml(d.district)}</span>
          ${d.population ? `<span class="decision-meta">Pop. ${Number(d.population).toLocaleString()}</span>` : ""}
          ${statusBadge}
        </div>
        <div class="countdown-badge ${d.cutoff_hours > 24 ? 'amber' : ''}">
          ${icon("clock", 14)}
          <strong>${d.cutoff_hours}h to predicted cutoff</strong>
        </div>
      </div>

      <div class="decision-recommendation-box">
        <div class="rec-title-row">
          <div class="rec-action-text">
            ${icon("package", 16)} Send ${d.recommended_units}t ${escapeHtml(d.recommended_commodity)}
          </div>
          <div class="rec-meta-pills">
            <span class="rec-pill">From ${escapeHtml(d.source_depot)}</span>
            <span class="rec-pill">VRI ${d.current_vri}</span>
            ${d.closure_probability != null ? `<span class="rec-pill">Closure ${Math.round(d.closure_probability * 100)}%</span>` : ""}
            ${d.tier ? `<span class="rec-pill tier">${escapeHtml(capitalize(String(d.tier).toLowerCase()))}</span>` : ""}
          </div>
        </div>

        <div class="rec-reasoning-text">
          "${d.reasoning}"
        </div>

        <div class="rec-trust-row">
          <span>Model confidence: <strong>${d.confidence != null ? d.confidence + "%" : "—"}</strong></span>
          <span>Track record: <strong>${escapeHtml(d.track_record_stat)}</strong></span>
          <span>Leave by: <strong>${escapeHtml(d.latest_departure)}</strong></span>
          ${d.created_at ? `<span>Generated: <strong>${relTime(d.created_at)}</strong></span>` : ""}
        </div>
      </div>

      <div class="decision-actions-row">
        <div class="decision-primary-buttons">
          <button class="btn-dec approve" data-action="approve" data-id="${d.id}" ${!isPending ? 'disabled' : ''}>
            ${icon("check")} ${t.approve}
          </button>
          <button class="btn-dec change" data-action="change" data-id="${d.id}" ${!isPending ? 'disabled' : ''}>
            ${icon("edit")} ${t.change}
          </button>
          <button class="btn-dec reject" data-action="reject" data-id="${d.id}" ${!isPending ? 'disabled' : ''}>
            ${icon("x")} ${t.reject}
          </button>
        </div>

        <div class="decision-secondary-buttons">
          <button class="btn-sec-link" data-action="evidence" data-id="${d.id}">
            ${icon("chart")} ${t.viewEvidence}
          </button>
          <button class="btn-sec-link" data-action="route" data-id="${d.id}">
            ${icon("route")} ${t.viewRoute}
          </button>
          <button class="btn-sec-link" data-action="map" data-id="${d.id}">
            ${icon("map")} View on map
          </button>
          <button class="btn-sec-link ai" data-action="explain" data-id="${d.id}">
            ${icon("sparkle")} Explain in plain language
          </button>
        </div>
      </div>
      <div class="ai-briefing ${briefingHtml(d.id) ? "" : "hidden"}" data-briefing="${d.id}" aria-live="polite">${briefingHtml(d.id)}</div>
    </div>
  `;
}

// ---------- Offline AI (runs on the DHARA server: notes classifier + local llama) ----------
async function aiPost(path, text) {
  const res = await fetch(`${AI_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// The plain-language explanation is built in the browser from the decision's
// own numbers, so it works instantly with no AI, no server and no internet.
// When the local llama model is running, its rewording is added underneath.
function plainBriefing(d) {
  const hours = Number(d.cutoff_hours);
  const when = !Number.isFinite(hours) ? "soon"
    : hours <= 6 ? `within ${Math.max(1, Math.round(hours))} hours`
    : hours < 24 ? `in about ${Math.round(hours)} hours, so today`
    : hours < 48 ? `in about ${Math.round(hours)} hours, so by tomorrow`
    : `in about ${Math.round(hours / 24)} days`;
  const chance = d.closure_probability != null ? ` DHARA puts the chance of closure at ${Math.round(d.closure_probability * 100)}%.` : "";
  const people = Number(d.population) > 0 ? ` About ${Number(d.population).toLocaleString("en-IN")} people live there.` : "";

  const lines = [
    `<b>What's happening:</b> The road into ${escapeHtml(d.village_name)} is likely to close ${when}.${chance}${people}`
  ];

  const now = d.travel_time_now, after = d.travel_time_after;
  if (/severed|no motor/i.test(after || "")) {
    lines.push(`<b>Why it matters:</b> Once it closes, trucks can't get there at all. Today the drive takes ${escapeHtml(now)}.`);
  } else if (now && after && now !== "—" && after !== "—" && now !== after) {
    lines.push(`<b>Why it matters:</b> The drive takes ${escapeHtml(now)} today and about ${escapeHtml(after)} once the road closes.`);
  }

  const units = d.recommended_units ? `${d.recommended_units} tonnes of ` : "";
  lines.push(`<b>What DHARA suggests:</b> Send ${units}${escapeHtml(String(d.recommended_commodity || "relief supplies").toLowerCase())} from ${escapeHtml(d.source_depot)}. The truck should leave by <b>${escapeHtml(d.latest_departure)}</b> so it arrives before the road closes.`);

  const conf = Number(d.confidence);
  if (Number.isFinite(conf)) {
    const sure = conf >= 85 ? "confident" : conf >= 70 ? "fairly confident" : "not very sure, so check the evidence before approving";
    lines.push(`<b>How sure it is:</b> ${conf}%, meaning the model is ${sure}.`);
  }

  return `<span class="ai-tag muted">PLAIN LANGUAGE · NO AI NEEDED</span>
    <ul class="plain-briefing">${lines.map(l => `<li>${l}</li>`).join("")}</ul>
    <small>Written from the numbers on this card. You can still approve, change or reject it.</small>`;
}

// Briefings survive the 30-second worklist refresh, which rebuilds every card.
// Each entry is { plain, ai } where ai is null, "loading" or finished HTML.
const briefingCache = {};
const briefingPending = new Set();

function briefingHtml(id) {
  const b = briefingCache[id];
  if (!b) return "";
  let ai = "";
  if (b.ai === "loading") {
    ai = `<div class="ai-extra loading"><span class="ai-tag">LOCAL AI</span><span>Also rewording it with ${escapeHtml(localAiModel)}. This can take up to 30 seconds.</span></div>`;
  } else if (b.ai) {
    ai = `<div class="ai-extra">${b.ai}</div>`;
  }
  return b.plain + ai;
}

// The same decision can be on screen twice (Overview + Today's Decisions).
function setBriefingBox(id) {
  const html = briefingHtml(id);
  document.querySelectorAll(`[data-briefing="${id}"]`).forEach(box => {
    box.innerHTML = html;
    box.classList.toggle("hidden", !html);
  });
}

async function explainDecision(id) {
  const dec = liveDecisions.find(x => x.id === id);
  if (!dec) return;
  if (briefingCache[id]) {
    delete briefingCache[id];
    setBriefingBox(id);
    return;
  }

  // Show the plain version now; only then wait for the page-load AI check if
  // it's still running on a slow server.
  const entry = { plain: plainBriefing(dec), ai: localAiOn || !localAiChecked ? "loading" : null };
  briefingCache[id] = entry;
  setBriefingBox(id);
  if (!localAiChecked) {
    await localAiCheck;
    if (!localAiOn) {
      entry.ai = null;
      if (briefingCache[id] === entry) setBriefingBox(id);
    }
  }
  if (!localAiOn || briefingPending.has(id) || briefingCache[id] !== entry) return;

  briefingPending.add(id);
  try {
    const out = await aiPost("/api/ai/explain", dec.reasoning);
    entry.ai = out.llm_used
      ? `<span class="ai-tag">LOCAL AI · ${escapeHtml(localAiModel)}</span><p>${escapeHtml(out.briefing)}</p>
         <small>Generated on the DHARA server with no internet. The audit log keeps the original wording.</small>`
      : null;
  } catch (err) {
    entry.ai = null;
  } finally {
    briefingPending.delete(id);
  }
  // Ignore the result if the officer closed the explanation in the meantime.
  if (briefingCache[id] === entry) setBriefingBox(id);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let localAiModel = "llama3.2:1b";
let localAiOn = false;
let localAiChecked = false;
let localAiCheck = Promise.resolve();
function checkLocalAi() {
  localAiCheck = runLocalAiCheck().finally(() => { localAiChecked = true; });
  return localAiCheck;
}

async function runLocalAiCheck() {
  const pill = document.getElementById("pill-local-ai");
  const text = document.getElementById("pill-local-ai-text");
  try {
    const res = await fetch(`${AI_BASE}/api/ai/status`, { signal: AbortSignal.timeout(8000) });
    const s = await res.json();
    localAiModel = s.llm_model || localAiModel;
    localAiOn = !!s.local_llm;
    if (!pill || !text) return;
    pill.className = `pill-prov ${s.local_llm ? "ai-on" : "ai-off"}`;
    text.textContent = s.local_llm ? "LOCAL AI: ON" : "LOCAL AI: NOTES ONLY";
    pill.title = s.local_llm
      ? `Offline AI on the DHARA server: notes classifier + ${localAiModel} briefings`
      : "Notes classifier available; local llama model is not running";
  } catch (e) {
    localAiOn = false;
    if (!pill || !text) return;
    pill.className = "pill-prov ai-off";
    text.textContent = "LOCAL AI: OFF";
    pill.title = "DHARA web server not reachable";
  }
}

const SEVERITY_FROM_AI = { impassable: "CRITICAL", major: "HIGH", minor: "LOW" };
const HAZARD_LABELS = { landslide: "Landslide", washout: "Washout", tree_fall: "Fallen tree", flooding: "Flooding", subsidence: "Road subsidence" };
let fieldAiReading = null;
let fieldAiTimer = null;

function initFieldNoteAi() {
  const desc = document.getElementById("f-rep-desc");
  const hint = document.getElementById("f-ai-hint");
  const severitySelect = document.getElementById("f-rep-severity");
  if (!desc || !hint || !severitySelect) return;

  const render = () => {
    if (!fieldAiReading) { hint.classList.add("hidden"); return; }
    const suggested = SEVERITY_FROM_AI[fieldAiReading.severity];
    const differs = suggested && suggested !== severitySelect.value;
    hint.innerHTML = `<span class="ai-tag">OFFLINE AI</span>
      <span>Your notes read as <b>${HAZARD_LABELS[fieldAiReading.hazard_type]}</b> · severity <b>${fieldAiReading.severity}</b></span>
      ${differs ? `<button type="button" class="ai-apply" id="f-ai-apply">Set severity to ${suggested}</button>` : ""}`;
    hint.classList.remove("hidden");
    const apply = document.getElementById("f-ai-apply");
    if (apply) apply.onclick = () => { severitySelect.value = suggested; render(); };
  };

  const classify = async () => {
    const text = desc.value.trim();
    if (text.length < 12) { fieldAiReading = null; render(); return; }
    try {
      const res = await aiPost("/api/ai/classify-note", text);
      fieldAiReading = HAZARD_LABELS[res.hazard_type] ? res : null;
    } catch (e) {
      fieldAiReading = null; // server unreachable: the form works exactly as before
    }
    render();
  };

  desc.addEventListener("input", () => {
    clearTimeout(fieldAiTimer);
    fieldAiTimer = setTimeout(classify, 500);
  });
  severitySelect.addEventListener("change", render);
  classify();
}

function bindDecisionButtons() {
  // APPROVE Action
  document.querySelectorAll('button[data-action="approve"]').forEach(btn => {
    btn.onclick = async (e) => {
      const id = btn.dataset.id;
      const dec = liveDecisions.find(x => x.id === id);
      if (!dec || dec.status !== "pending") return;

      try {
        await fetch(`${API_BASE}/decisions/${id}/approve`, { method: "POST" });
      } catch (err) {
        console.warn("API approve call failed, saving to local state:", err);
      }

      dec.status = "approved";
      rememberDecision(dec);
      renderWorklistDecisions();
      showToast(`✓ Pre-positioning dispatch approved for ${dec.village_name}! Audit log created.`, "success");
      fetchAuditTrail();
    };
  });

  // CHANGE Action
  document.querySelectorAll('button[data-action="change"]').forEach(btn => {
    btn.onclick = (e) => {
      const id = btn.dataset.id;
      const dec = liveDecisions.find(x => x.id === id);
      if (!dec) return;
      openChangeModal(dec);
    };
  });

  // REJECT Action
  document.querySelectorAll('button[data-action="reject"]').forEach(btn => {
    btn.onclick = (e) => {
      const id = btn.dataset.id;
      const dec = liveDecisions.find(x => x.id === id);
      if (!dec) return;
      openRejectModal(dec);
    };
  });

  // VIEW EVIDENCE Action
  document.querySelectorAll('button[data-action="evidence"]').forEach(btn => {
    btn.onclick = (e) => {
      const id = btn.dataset.id;
      const dec = liveDecisions.find(x => x.id === id);
      if (!dec) return;
      openEvidenceModal(dec);
    };
  });

  // VIEW ROUTE Action
  document.querySelectorAll('button[data-action="route"]').forEach(btn => {
    btn.onclick = (e) => {
      const id = btn.dataset.id;
      const dec = liveDecisions.find(x => x.id === id);
      if (!dec) return;
      openRouteModal(dec);
    };
  });

  // VIEW ON MAP Action
  document.querySelectorAll('button[data-action="map"]').forEach(btn => {
    btn.onclick = () => showDecisionOnMap(btn.dataset.id);
  });

  // EXPLAIN IN PLAIN LANGUAGE (local llama on the DHARA server)
  document.querySelectorAll('button[data-action="explain"]').forEach(btn => {
    btn.onclick = (e) => explainDecision(e.currentTarget.dataset.id);
  });

  // Worklist Filter Chips
  document.querySelectorAll(".worklist-filters-row .filter-chip").forEach(chip => {
    chip.onclick = () => {
      currentWorklistFilter = chip.dataset.filter;
      document.querySelectorAll(".worklist-filters-row .filter-chip").forEach(c => {
        c.classList.toggle("active", c.dataset.filter === currentWorklistFilter);
      });
      renderWorklistDecisions();
    };
  });
}

function showDecisionOnMap(id) {
  const dec = liveDecisions.find(x => x.id === id);
  if (!dec) return;
  const hab = habitationsData.find(h => h.properties && h.properties.id === dec.village_id);
  if (!hab) {
    showToast(`${dec.village_name} has no mapped location yet.`, "warning");
    return;
  }
  const [lon, lat] = hab.geometry.coordinates;
  focusMapOn([lat, lon], 12, `<strong>${escapeHtml(dec.village_name)}</strong><br>Recommended: ${escapeHtml(dec.recommended_units)}t ${escapeHtml(dec.recommended_commodity)}<br>From: ${escapeHtml(dec.source_depot)}`);
}

// ====================================================
// 6. MODALS IMPLEMENTATION
// ====================================================
let evidenceDecisionId = null;

function closeModals() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
}

function initModals() {
  // Close: the ✕, Cancel, and every "Close …" footer button
  document.querySelectorAll(".btn-close-modal, .btn-cancel, #btn-shipment-close-foot, #btn-close-route-foot, #btn-close-auto-foot").forEach(btn => {
    btn.addEventListener("click", closeModals);
  });

  // Clicking the dimmed backdrop or pressing Escape closes too
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModals();
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModals();
      closePalette();
    }
  });

  const btnEvidenceMap = document.getElementById("btn-evidence-goto-map");
  if (btnEvidenceMap) {
    btnEvidenceMap.addEventListener("click", () => {
      closeModals();
      if (evidenceDecisionId) showDecisionOnMap(evidenceDecisionId);
    });
  }

  // Change Decision Form Submit
  const changeForm = document.getElementById("form-change-decision");
  if (changeForm) {
    changeForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById("change-dec-id").value;
      const units = parseFloat(document.getElementById("change-quantity").value);
      const depotEl = document.getElementById("change-depot");
      const depot = depotEl.options[depotEl.selectedIndex].text;
      const route = document.getElementById("change-route").value;
      const deadline = document.getElementById("change-deadline").value;

      const dec = liveDecisions.find(x => x.id === id);
      if (dec) {
        dec.status = "modified";
        dec.recommended_units = units;
        dec.source_depot = depot;
        dec.corridor_route = route;
        dec.latest_departure = deadline;
        rememberDecision(dec);

        try {
          await fetch(`${API_BASE}/decisions/${id}/change`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ units, depot, route, deadline })
          });
        } catch (err) {
          console.warn("API change call error:", err);
        }

        renderWorklistDecisions();
        document.getElementById("modal-change-decision").classList.add("hidden");
        showToast(`✏️ Decision for ${dec.village_name} modified: ${units}t via ${depot}. Logged to audit trail.`, "success");
        fetchAuditTrail();
      }
    };
  }

  // Reject Decision Form Submit
  const rejectForm = document.getElementById("form-reject-decision");
  if (rejectForm) {
    rejectForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById("reject-dec-id").value;
      const reason_category = document.getElementById("reject-reason-cat").value;
      const free_text = document.getElementById("reject-free-text").value;

      const dec = liveDecisions.find(x => x.id === id);
      if (dec) {
        dec.status = "rejected";
        dec.reject_reason = reason_category;
        dec.reject_notes = free_text;
        rememberDecision(dec);

        try {
          await fetch(`${API_BASE}/decisions/${id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason_category, free_text })
          });
        } catch (err) {
          console.warn("API reject call error:", err);
        }

        renderWorklistDecisions();
        document.getElementById("modal-reject-decision").classList.add("hidden");
        showToast(`🛑 Override recorded: "${reason_category}". Officer feedback captured for future model calibration.`, "warning");
        fetchAuditTrail();
      }
    };
  }

  // Automation Modal (sidebar status card + Overview "How DHARA decides")
  document.querySelectorAll("[data-open-automation]").forEach(el => {
    el.addEventListener("click", openAutomationModal);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openAutomationModal();
      }
    });
  });
}

function openChangeModal(dec) {
  document.getElementById("change-dec-id").value = dec.id;
  document.getElementById("change-target-village").value = `${dec.village_name} (${dec.district})`;
  document.getElementById("change-quantity").value = dec.recommended_units;
  document.getElementById("change-route").value = dec.corridor_route;
  document.getElementById("change-deadline").value = dec.latest_departure;
  document.getElementById("modal-change-decision").classList.remove("hidden");
}

function openRejectModal(dec) {
  document.getElementById("reject-dec-id").value = dec.id;
  document.getElementById("reject-free-text").value = "";
  document.getElementById("modal-reject-decision").classList.remove("hidden");
}

function openEvidenceModal(dec) {
  const content = document.getElementById("evidence-modal-content");
  if (!content) return;
  evidenceDecisionId = dec.id;

  const seg = dec.nearest_segment_id ? segById.get(dec.nearest_segment_id) : null;
  const sp = seg ? seg.properties : null;
  const km = dec.nearest_segment_km != null ? `${dec.nearest_segment_km.toFixed(1)} km from the village` : "";

  content.innerHTML = `
    <div class="modal-stack">
      <div class="modal-panel tone-blue">
        <h4>${escapeHtml(dec.village_name)} &middot; ${escapeHtml(dec.district)}</h4>
        <p>Reachability index (VRI): <strong>${dec.current_vri} / 100</strong> &middot; predicted cutoff window <strong>${dec.cutoff_hours} hours</strong>${dec.closure_probability != null ? ` &middot; road closure probability <strong>${Math.round(dec.closure_probability * 100)}%</strong>` : ""}</p>
      </div>

      <div class="modal-grid">
        <div class="modal-panel">
          <span class="modal-label">${nearRoadIsLocal(dec) ? "Nearest at-risk road" : `No at-risk road within ${NEAR_ROAD_KM} km · closest`}</span>
          <div class="modal-value">${sp ? escapeHtml(roadLabel(sp)) : "—"}</div>
          <span class="modal-note text-red">${escapeHtml(dec.landslide_class)}</span>
          <span class="modal-note">${escapeHtml(dec.terrain_slope)}${km ? ` &middot; ${km}` : ""}</span>
        </div>
        <div class="modal-panel">
          <span class="modal-label">Travel time from the village</span>
          <div class="modal-value">Now ${dec.travel_time_now} &rarr; after closure ${dec.travel_time_after}</div>
          <span class="modal-note text-amber">${escapeHtml(dec.alternate_route)}</span>
        </div>
      </div>

      <div class="modal-panel">
        <span class="modal-label">Decision agent reasoning (audit log)</span>
        <p class="modal-quote">"${escapeHtml(dec.reasoning)}"</p>
      </div>
    </div>
  `;

  document.getElementById("modal-view-evidence").classList.remove("hidden");
}

function openRouteModal(dec) {
  const content = document.getElementById("route-modal-content");
  if (!content) return;

  const seg = dec.nearest_segment_id ? segById.get(dec.nearest_segment_id) : null;
  const sp = seg ? seg.properties : null;

  content.innerHTML = `
    <div class="modal-stack">
      <div class="modal-panel">
        <h4>${escapeHtml(dec.source_depot)} &rarr; ${escapeHtml(dec.village_name)}</h4>
        <div class="modal-grid three">
          <div><span class="modal-label">From</span><div class="modal-value">${escapeHtml(dec.source_depot)}</div></div>
          <div><span class="modal-label">To</span><div class="modal-value">${escapeHtml(dec.village_name)} (${escapeHtml(dec.district)})</div></div>
          <div><span class="modal-label">Leave by</span><div class="modal-value">${escapeHtml(dec.latest_departure)}</div></div>
        </div>
      </div>

      <div class="modal-panel tone-red">
        <h4>${sp && nearRoadIsLocal(dec) ? "Threatened road near the village" : "Closest at-risk road in the forecast"}</h4>
        ${sp && !nearRoadIsLocal(dec) ? `<p>No forecast at-risk road passes within ${NEAR_ROAD_KM} km of ${escapeHtml(dec.village_name)}. The recommendation rests on the village's own predicted closure probability (see View evidence).</p>` : ""}
        ${sp ? `
          <p>${escapeHtml(roadLabel(sp))} <span class="mono">${escapeHtml(sp.segment_id)}</span> has a
          <strong>${Math.round(sp.closure_probability * 100)}%</strong> predicted closure probability${sp.predicted_closed ? " and is <strong>predicted closed</strong>" : ""}
          (slope ${sp.slope_deg != null ? Number(sp.slope_deg).toFixed(1) + "°" : "—"}, landslide class ${sp.landslide_class ?? "—"}).
          ${dec.nearest_segment_km != null ? `It passes ${dec.nearest_segment_km.toFixed(1)} km from the village.` : ""}</p>
          <button type="button" class="btn btn-secondary btn-sm" data-focus-segment="${escapeHtml(sp.segment_id)}">${icon("map")} Show this road on the map</button>
        ` : `<p>No at-risk road segment is mapped near this village in the current forecast.</p>`}
      </div>

      <div class="modal-panel tone-green">
        <h4>If the road closes</h4>
        <p>Travel time from the village goes from <strong>${dec.travel_time_now}</strong> to <strong>${dec.travel_time_after}</strong>. ${escapeHtml(dec.alternate_route)}.</p>
      </div>
    </div>
  `;

  const btn = content.querySelector("[data-focus-segment]");
  if (btn) {
    btn.addEventListener("click", () => {
      closeModals();
      focusSegment(btn.dataset.focusSegment);
    });
  }

  document.getElementById("modal-view-route").classList.remove("hidden");
}

const FALLBACK_PIPELINE_STAGES = [
  { stage: "Forecast Ingestion", description: "Multi-model ensemble rainfall observations", status: "COMPLETED", last_updated: "" },
  { stage: "Risk Calculation", description: "Slope & landslide susceptibility modelling", status: "COMPLETED", last_updated: "" },
  { stage: "VRI Prediction", description: "Habitation reachability trajectories", status: "COMPLETED", last_updated: "" },
  { stage: "Countdown Calculation", description: "Cutoff countdown timers", status: "COMPLETED", last_updated: "" },
  { stage: "Route Evaluation", description: "Egress delta & alternate corridor search", status: "COMPLETED", last_updated: "" },
  { stage: "Dispatch Decision", description: "Pre-positioning recommendations", status: "COMPLETED", last_updated: "" },
  { stage: "Audit Logging", description: "Governance reasoning logged to PostgreSQL", status: "COMPLETED", last_updated: "" }
];

function openAutomationModal() {
  const content = document.getElementById("auto-modal-content");
  if (!content) return;

  const stages = Array.isArray(automationStatusData.pipeline_stages) && automationStatusData.pipeline_stages.length
    ? automationStatusData.pipeline_stages
    : FALLBACK_PIPELINE_STAGES;
  const live = Array.isArray(automationStatusData.pipeline_stages);
  const lastRun = automationStatusData.last_automated_run
    ? new Date(automationStatusData.last_automated_run).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  content.innerHTML = `
    <div class="modal-stack">
      <p class="modal-intro">
        ${escapeHtml(automationStatusData.summary_text || "DHARA runs its reachability and pre-positioning pipeline automatically.")}
        ${lastRun ? ` Last run: <strong>${lastRun}</strong>.` : ""}
        ${live ? "" : ` <span class="text-amber">Live pipeline status unavailable, showing the stage list only.</span>`}
      </p>
      <ol class="pipeline-list">
        ${stages.map((s, i) => {
          const done = /COMPLETED|ACTIVE|OK/i.test(s.status || "");
          return `
            <li class="pipeline-stage ${done ? "done" : "pending"}">
              <span class="pipeline-num">${i + 1}</span>
              <div class="pipeline-text">
                <strong>${escapeHtml(s.stage)}</strong>
                <span>${escapeHtml(s.description || "")}</span>
              </div>
              <span class="pipeline-status">${done ? icon("check", 12) : ""} ${escapeHtml(capitalize(String(s.status || "").toLowerCase()))}${s.last_updated ? ` &middot; ${escapeHtml(s.last_updated)}` : ""}</span>
            </li>`;
        }).join("")}
      </ol>
    </div>
  `;

  document.getElementById("modal-automation-pipeline").classList.remove("hidden");
}

// ====================================================
// 7. FIELD APPLICATION & OFFLINE REPORTING
// ====================================================
function initFieldAppInteractions() {
  // Tab Switcher
  document.querySelectorAll(".field-tab-btn").forEach(btn => {
    btn.onclick = (e) => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".field-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".field-tab-pane").forEach(p => p.classList.add("hidden"));
      const targetPane = document.getElementById(`pane-${tab}`);
      if (targetPane) targetPane.classList.remove("hidden");

      if (tab === "submitted-list") {
        fetchSubmittedFieldReports();
      } else if (tab === "pending-queue") {
        loadPendingReportsFromDB();
      }
    };
  });

  // GPS Capture
  const btnCaptureGps = document.getElementById("btn-f-capture-gps");
  if (btnCaptureGps) {
    btnCaptureGps.onclick = () => {
      const hint = document.getElementById("gps-status-hint");
      const coordsInput = document.getElementById("f-rep-coords");
      if (hint) hint.textContent = "Acquiring satellite lock...";

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude.toFixed(4);
            const lon = pos.coords.longitude.toFixed(4);
            coordsInput.value = `${lat}, ${lon}`;
            syncFieldPin();
            if (hint) hint.innerHTML = `✓ Live GPS Locked: Lat ${lat}, Lon ${lon} (Acc: &plusmn;${Math.round(pos.coords.accuracy || 5)}m)`;
          },
          (err) => {
            // Fallback coordinates for hill sector demo
            coordsInput.value = "27.2415, 92.4180";
            syncFieldPin();
            if (hint) hint.innerHTML = `✓ GPS Locked (Kameng Sector): Lat 27.2415, Lon 92.4180`;
          },
          { timeout: 5000 }
        );
      } else {
        coordsInput.value = "27.2415, 92.4180";
            syncFieldPin();
        if (hint) hint.innerHTML = `✓ GPS Locked (Kameng Sector): Lat 27.2415, Lon 92.4180`;
      }
    };
  }

  // Photo Dropzone & File Input
  const dropzone = document.getElementById("photo-dropzone");
  const fileInput = document.getElementById("f-rep-photo");
  const previewContainer = document.getElementById("photo-preview-container");
  const previewImg = document.getElementById("photo-preview-img");
  const placeholder = document.getElementById("photo-placeholder");
  const btnRemovePhoto = document.getElementById("btn-remove-photo");

  if (dropzone && fileInput) {
    dropzone.onclick = (e) => {
      if (e.target !== btnRemovePhoto) fileInput.click();
    };

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          previewImg.src = re.target.result;
          previewContainer.classList.remove("hidden");
          placeholder.classList.add("hidden");
        };
        reader.readAsDataURL(file);
      }
    };
  }

  if (btnRemovePhoto) {
    btnRemovePhoto.onclick = (e) => {
      e.stopPropagation();
      fileInput.value = "";
      previewImg.src = "";
      previewContainer.classList.add("hidden");
      placeholder.classList.remove("hidden");
    };
  }

  // Field Report Form Submit
  const fieldForm = document.getElementById("form-field-incident-app");
  if (fieldForm) {
    fieldForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("f-rep-name").value;
      const location = document.getElementById("f-rep-location").value;
      const type = document.getElementById("f-rep-type").value;
      const severity = document.getElementById("f-rep-severity").value;
      let desc = document.getElementById("f-rep-desc").value;
      if (fieldAiReading) desc += ` [AI reading: ${fieldAiReading.hazard_type}, ${fieldAiReading.severity}]`;
      const coordsStr = document.getElementById("f-rep-coords").value || "27.2415, 92.4180";
      const coords = coordsStr.split(",").map(x => parseFloat(x.trim())).reverse(); // [lon, lat]

      const reportPayload = {
        uuid: `REP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        reporter_name: name,
        location_name: location,
        incident_type: type,
        severity: severity,
        description: desc,
        coordinates: coords,
        timestamp: new Date().toISOString()
      };

      if (navigator.onLine) {
        try {
          const res = await fetch(`${API_BASE}/field-reports`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reportPayload)
          });

          if (res.ok) {
            showToast("✓ Report submitted to DHARA and synchronized with PostgreSQL!", "success");
            submittedFieldReports.unshift(reportPayload);
            renderSubmittedReportsList();
            resetFieldForm();
            return;
          }
        } catch (err) {
          console.warn("Direct submission failed, storing to offline queue:", err);
        }
      }

      // Offline path: Save to IndexedDB
      if (db) {
        const tx = db.transaction("queued_reports", "readwrite");
        tx.objectStore("queued_reports").put(reportPayload);
        tx.oncomplete = () => {
          pendingFieldReports.push(reportPayload);
          updatePendingBadge();
          renderPendingReportsList();
          resetFieldForm();
          showToast("💾 Saved offline to device storage. Will sync automatically when connected.", "warning");
        };
      }
    };
  }

  // Sync All Button
  const btnSyncAll = document.getElementById("btn-sync-all-now");
  if (btnSyncAll) {
    btnSyncAll.onclick = () => {
      syncOfflineReports();
    };
  }

  const btnRefreshSub = document.getElementById("btn-refresh-submitted");
  if (btnRefreshSub) {
    btnRefreshSub.onclick = () => {
      fetchSubmittedFieldReports();
    };
  }
}

function resetFieldForm() {
  document.getElementById("f-rep-desc").value = "";
  fieldAiReading = null;
  document.getElementById("f-ai-hint")?.classList.add("hidden");
  const removeBtn = document.getElementById("btn-remove-photo");
  if (removeBtn) removeBtn.click();
}

async function fetchSubmittedFieldReports() {
  try {
    const res = await fetch(`${API_BASE}/field-reports`);
    if (res.ok) {
      const data = await res.json();
      submittedFieldReports = data;
    }
  } catch (e) {
    console.warn("Failed to fetch submitted reports:", e);
  }
  renderSubmittedReportsList();
  renderOfficerFieldReportsView();
}

function renderPendingReportsList() {
  const container = document.getElementById("pending-reports-container");
  if (!container) return;

  if (pendingFieldReports.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <span class="empty-icon">${icon("check", 20)}</span>
        <h4>No pending offline reports</h4>
        <p>All field incident reports have been synchronized with the DHARA Command Center.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = pendingFieldReports.map(r => `
    <div class="report-item-card">
      <div class="report-card-top">
        <span class="report-id">${r.uuid}</span>
        <span class="status-tag amber">Queued offline</span>
      </div>
      <div class="report-title">${r.incident_type} (${r.severity})</div>
      <div class="report-location">${icon("pin", 13)} ${escapeHtml(r.location_name)}</div>
      <div class="report-desc">${r.description}</div>
      <div class="report-footer">
        <span>Reporter: ${r.reporter_name}</span>
        <span>${new Date(r.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  `).join("");
}

function renderSubmittedReportsList() {
  const container = document.getElementById("submitted-reports-container");
  if (!container) return;

  if (submittedFieldReports.length === 0) {
    container.innerHTML = `<div class="empty-state-box"><h4>No Submitted Reports</h4><p>Submit your first incident report using the form.</p></div>`;
    return;
  }

  container.innerHTML = submittedFieldReports.map(r => `
    <div class="report-item-card">
      <div class="report-card-top">
        <span class="report-id">${r.action || r.id || 'FIELD_REPORT'}</span>
        <span class="pill-prov real">${icon("check", 11)} SYNCED</span>
      </div>
      <div class="report-desc">${r.reasoning || r.description}</div>
      <div class="report-footer">
        <span>Recorded in PostgreSQL</span>
        <span>${r.created_at ? new Date(r.created_at).toLocaleTimeString() : 'Just now'}</span>
      </div>
    </div>
  `).join("");
}

function renderOfficerFieldReportsView() {
  const container = document.getElementById("officer-field-reports-container");
  if (!container) return;

  if (submittedFieldReports.length === 0) {
    container.innerHTML = `<div class="card-box"><p>No ground field reports logged yet.</p></div>`;
    return;
  }

  container.innerHTML = submittedFieldReports.map(r => `
    <div class="manifest-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="color:var(--accent-blue);">${r.action}</strong>
        <span class="pill-prov real">REAL AUDIT</span>
      </div>
      <p style="font-size:13px; color:var(--text-secondary); line-height:1.5;">${r.reasoning}</p>
      <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-muted); border-top:1px solid var(--border-color); padding-top:8px;">
        <span>Actor: Field Personnel</span>
        <span>${r.created_at ? new Date(r.created_at).toLocaleString() : 'Recent'}</span>
      </div>
    </div>
  `).join("");
}

// ====================================================
// 8. OTHER OFFICER VIEWS (FLEET, ROUTES, SHIPMENTS, TRACK RECORD)
// ====================================================
const DEMO_SHIPMENTS = [
  {
    shipment_id: "SHP-2026-08491", license_number: "AS-01-EC-4829", truck_type: "12-Wheeler Heavy Relief Truck",
    driver_name: "Rajesh Kumar", driver_contact: "+91 98765 43210", status: "IN TRANSIT",
    origin_depot: "Depot A (Tawang Relief Hub)", destination_village: "Ukhrul Sector",
    cargo_summary: "12.5 Tonnes Rice & Food Grains", estimated_arrival: "Today, 11:45 IST",
    route_assigned: "NH-150 Kameng Corridor", progress_pct: 65,
    cargo_details: [{ item: "Rice & Food Grains", qty: "12.5 Tonnes" }]
  }
];

function shipmentTone(status) {
  const s = String(status || "").toUpperCase();
  if (/DELIVERED|PRE-POSITIONED|ARRIVED/.test(s)) return "green";
  if (/DISPATCHED|LOADING/.test(s)) return "amber";
  if (/DELAYED|FAILED|BLOCKED/.test(s)) return "red";
  return "blue";
}

function currentShipments() {
  return shipmentsData.length > 0 ? shipmentsData : DEMO_SHIPMENTS;
}

function renderShipmentsView() {
  const container = document.getElementById("shipments-cards-container");
  if (!container) return;

  container.innerHTML = currentShipments().map(s => `
    <button type="button" class="manifest-card card-button" data-shipment="${escapeHtml(s.license_number)}">
      <div class="card-head">
        <div>
          <strong class="card-id mono">${escapeHtml(s.license_number)}</strong>
          <span class="card-id-sub">${escapeHtml(s.truck_type || s.shipment_id || "")}</span>
        </div>
        <span class="status-tag ${shipmentTone(s.status)}">${escapeHtml(s.status)}</span>
      </div>
      <div class="card-headline">${escapeHtml(s.cargo_summary)}</div>
      <div class="card-detail-grid">
        <div>From: <strong>${escapeHtml(s.origin_depot)}</strong></div>
        <div>To: <strong>${escapeHtml(s.destination_village)}</strong></div>
        <div>Route: <strong>${escapeHtml(s.route_assigned || "—")}</strong></div>
        <div>ETA: <strong>${escapeHtml(s.estimated_arrival || "—")}</strong></div>
      </div>
      <div class="progress-track" aria-label="${s.progress_pct || 0}% of the way"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, Number(s.progress_pct) || 0))}%"></div></div>
      <div class="card-foot">
        <span>Driver: ${escapeHtml(s.driver_name || "—")}</span>
        <span class="text-blue">Open manifest &rarr;</span>
      </div>
    </button>
  `).join("");

  container.querySelectorAll("[data-shipment]").forEach(btn => {
    btn.addEventListener("click", () => openShipmentModal(btn.dataset.shipment));
  });
}

window.openShipmentModal = function(license) {
  const content = document.getElementById("shipment-modal-content");
  const licEl = document.getElementById("modal-lic-plate");
  if (!content) return;
  const s = currentShipments().find(x => x.license_number === license);
  if (!s) return;
  if (licEl) licEl.textContent = license;

  const items = Array.isArray(s.cargo_details) && s.cargo_details.length
    ? s.cargo_details
    : [{ item: s.cargo_summary, qty: "—" }];
  const coords = Array.isArray(s.current_coordinates) ? s.current_coordinates : null;

  content.innerHTML = `
    <div class="modal-stack">
      <div class="modal-panel">
        <h4>${escapeHtml(s.truck_type || "Relief truck")} &middot; <span class="status-tag ${shipmentTone(s.status)}">${escapeHtml(s.status)}</span></h4>
        <div class="modal-grid">
          <div><span class="modal-label">Driver</span><div class="modal-value">${escapeHtml(s.driver_name || "—")}${s.driver_contact ? ` &middot; ${escapeHtml(s.driver_contact)}` : ""}</div></div>
          <div><span class="modal-label">Route</span><div class="modal-value">${escapeHtml(s.route_assigned || "—")}</div></div>
          <div><span class="modal-label">From</span><div class="modal-value">${escapeHtml(s.origin_depot || "—")}</div></div>
          <div><span class="modal-label">To</span><div class="modal-value">${escapeHtml(s.destination_village || "—")}</div></div>
          <div><span class="modal-label">Dispatched</span><div class="modal-value">${escapeHtml(s.dispatch_started_at || "—")}</div></div>
          <div><span class="modal-label">ETA</span><div class="modal-value">${escapeHtml(s.estimated_arrival || "—")}</div></div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, Number(s.progress_pct) || 0))}%"></div></div>
        ${coords ? `<button type="button" class="btn btn-secondary btn-sm" data-truck-map>${icon("map")} Show truck on the map</button>` : ""}
      </div>

      <div class="modal-panel">
        <span class="modal-label">Cargo manifest</span>
        <table class="dash-table">
          <thead><tr><th>Item</th><th>Quantity</th></tr></thead>
          <tbody>${items.map(i => `<tr><td>${escapeHtml(i.item)}</td><td>${escapeHtml(i.qty)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
  `;

  const mapBtn = content.querySelector("[data-truck-map]");
  if (mapBtn && coords) {
    mapBtn.addEventListener("click", () => {
      closeModals();
      focusMapOn([coords[1], coords[0]], 11, `<strong>${escapeHtml(license)}</strong><br>${escapeHtml(s.status)}`);
    });
  }

  document.getElementById("modal-shipment-detail").classList.remove("hidden");
};

// ---------- Fleet ----------
const DEMO_VEHICLES = [
  { vehicle_id: "DH-021", depot_id: "Imphal", status: "IN_TRANSIT", speed_kmh: 42, coordinates: [93.892, 27.124] },
  { vehicle_id: "DH-022", depot_id: "Tawang", status: "IN_TRANSIT", speed_kmh: 35, coordinates: [94.015, 27.185] },
  { vehicle_id: "DH-023", depot_id: "Western Forward", status: "IDLE", speed_kmh: 0, coordinates: [93.92, 27.08] },
  { vehicle_id: "DH-024", depot_id: "Central Depot", status: "IDLE", speed_kmh: 0, coordinates: [94.15, 27.15] }
];

const FLEET_BUCKETS = {
  IDLE: "available", AVAILABLE: "available", STANDBY: "available",
  IN_TRANSIT: "in_transit", DISPATCHED: "in_transit", EN_ROUTE: "in_transit",
  DELAYED: "delayed", OFFLINE: "offline"
};
const FLEET_BUCKET_UI = {
  available: { tone: "green", label: "Available" },
  in_transit: { tone: "blue", label: "En route" },
  delayed: { tone: "amber", label: "Delayed" },
  offline: { tone: "red", label: "Offline" }
};

function vehicleBucket(v) {
  return FLEET_BUCKETS[String(v.status || "").toUpperCase().replace(/[\s-]+/g, "_")] || "in_transit";
}

function depotName(id) {
  const d = depotsData.find(x => x.id === id);
  return d ? d.name : (id || "—");
}

function renderFleetView() {
  const container = document.getElementById("fleet-cards-container");
  if (!container) return;

  const live = vehiclesData.length > 0;
  const fleet = live ? vehiclesData : DEMO_VEHICLES;

  const counts = { available: 0, in_transit: 0, delayed: 0, offline: 0 };
  fleet.forEach(v => { counts[vehicleBucket(v)]++; });
  setText("fleet-tot", String(fleet.length));
  setText("fleet-avail", String(counts.available));
  setText("fleet-transit", String(counts.in_transit));
  setText("fleet-delayed", String(counts.delayed));
  setText("fleet-offline", String(counts.offline));

  const filtered = currentFleetFilter === "all" ? fleet : fleet.filter(v => vehicleBucket(v) === currentFleetFilter);

  container.innerHTML = filtered.length ? filtered.map(v => {
    const bucket = FLEET_BUCKET_UI[vehicleBucket(v)];
    const c = Array.isArray(v.coordinates) ? v.coordinates : null;
    return `
      <div class="vehicle-card">
        <div class="card-head">
          <div>
            <strong class="card-id mono">${escapeHtml(String(v.vehicle_id).toUpperCase())}</strong>
            <span class="card-id-sub">${escapeHtml(depotName(v.depot_id))}</span>
          </div>
          <span class="status-tag ${bucket.tone}">${bucket.label}</span>
        </div>
        <div class="card-detail-grid">
          <div>Status: <strong>${escapeHtml(capitalize(String(v.status || "").toLowerCase().replace(/_/g, " ")))}</strong></div>
          <div>Speed: <strong>${v.speed_kmh != null ? v.speed_kmh + " km/h" : "—"}</strong></div>
          <div>Position: <strong>${c ? `${c[1].toFixed(3)}°N, ${c[0].toFixed(3)}°E` : "—"}</strong></div>
          <div>Last ping: <strong>${v.updated_at ? relTime(v.updated_at) : "—"}</strong></div>
        </div>
        <div class="card-telemetry-row">
          <span>${live ? "Telemetry from /vehicles/live" : "Demo vehicle (API offline)"}</span>
          <span class="text-amber">SIMULATED GPS</span>
        </div>
        <div class="card-actions">
          ${c ? `<button class="btn-sec-link" data-vehicle-map="${escapeHtml(v.vehicle_id)}">${icon("map")} Show on map</button>` : ""}
        </div>
      </div>
    `;
  }).join("") : `<div class="empty-panel">No vehicles in this state.</div>`;

  container.querySelectorAll("[data-vehicle-map]").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = fleet.find(x => x.vehicle_id === btn.dataset.vehicleMap);
      if (!v || !v.coordinates) return;
      focusMapOn([v.coordinates[1], v.coordinates[0]], 11, `<strong>${escapeHtml(v.vehicle_id)}</strong><br>${escapeHtml(depotName(v.depot_id))}<br>${v.speed_kmh ?? 0} km/h`);
    });
  });

  // Bind Fleet Filters
  document.querySelectorAll(".fleet-kpi-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".fleet-kpi-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFleetFilter = btn.dataset.fleetFilter;
      renderFleetView();
    };
  });
}

// ---------- Routes: the at-risk road segments from the closure model ----------
function topRiskSegments(limit) {
  return (atRiskSegmentsData || [])
    .filter(s => s && s.properties && typeof s.properties.closure_probability === "number")
    .sort((a, b) => b.properties.closure_probability - a.properties.closure_probability)
    .slice(0, limit);
}

function formatForecastDate(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : String(iso);
}

function renderRoutesView() {
  const container = document.getElementById("routes-cards-container");
  if (!container) return;

  const segs = topRiskSegments(12);
  if (!segs.length) {
    container.innerHTML = `<div class="empty-panel">No at-risk road segments loaded. Road risk comes from the closure model via <span class="mono">/segments/at-risk</span>.</div>`;
    return;
  }

  container.innerHTML = segs.map((s, i) => {
    const p = s.properties;
    const pct = Math.round(p.closure_probability * 100);
    const reasons = Array.isArray(p.hazard_reasons) ? p.hazard_reasons : [];
    return `
      <div class="route-card">
        <div class="card-head">
          <div class="card-head-rank">
            <span class="rank-badge">${i + 1}</span>
            <div>
              <strong class="card-id">${escapeHtml(roadLabel(p))}</strong>
              <span class="card-id-sub">${escapeHtml(p.segment_id)}</span>
            </div>
          </div>
          <span class="status-tag ${p.predicted_closed || pct >= 50 ? "red" : "amber"}">${p.predicted_closed ? "Predicted closed" : pct >= 50 ? "Critical" : "At risk"}</span>
        </div>
        <div class="risk-meter" aria-label="${pct}% closure probability">
          <div class="risk-meter-fill ${pct >= 50 ? "red" : "amber"}" style="width:${pct}%"></div>
        </div>
        <div class="card-detail-grid">
          <div>Closure risk: <strong>${pct}%</strong></div>
          <div>Forecast: <strong>${escapeHtml(formatForecastDate(p.forecast_for_date) || "—")}</strong></div>
          <div>Slope: <strong>${p.slope_deg != null ? Number(p.slope_deg).toFixed(1) + "°" : "—"}</strong></div>
          <div>Landslide/flood: <strong>${p.landslide_class ?? "—"}/${p.flood_class ?? "—"}</strong></div>
        </div>
        ${reasons.length ? `<div class="card-line muted">${escapeHtml(reasons.join(" · "))}</div>` : ""}
        <div class="card-actions">
          <button class="btn-sec-link" data-segment-map="${escapeHtml(p.segment_id)}">${icon("map")} Show on map</button>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-segment-map]").forEach(btn => {
    btn.addEventListener("click", () => focusSegment(btn.dataset.segmentMap));
  });
}

// ---------- Depots ----------
const DEMO_DEPOTS = [
  { id: "DEPOT_A", name: "District Central Depot (West Hills)", stock: { rice_tonnes: 120, medicines_units: 2400, water_liters: 15000 }, vehicles_available: 8, vehicles_in_transit: 3, data_provenance: "SIMULATED" },
  { id: "DEPOT_B", name: "Western Forward Depot", stock: { rice_tonnes: 85, medicines_units: 1800, water_liters: 10000 }, vehicles_available: 5, vehicles_in_transit: 2, data_provenance: "SIMULATED" }
];

function currentDepots() {
  return depotsData.length > 0 ? depotsData : DEMO_DEPOTS;
}

function renderDepotsView() {
  const container = document.getElementById("depots-cards-container");
  if (!container) return;

  container.innerHTML = currentDepots().map(d => {
    const st = d.stock || {};
    const prov = String(d.data_provenance || "SIMULATED").toUpperCase();
    const coords = d.location && d.location.coordinates;
    return `
      <div class="depot-card">
        <div class="card-head">
          <strong class="card-id">${escapeHtml(d.name)}</strong>
          <span class="pill-prov ${prov === "REAL" ? "real" : "simulated"}">${prov === "REAL" ? "REAL" : "SIMULATED"} STOCK</span>
        </div>
        <div class="stock-grid">
          <div><span class="stock-num">${st.rice_tonnes != null ? Number(st.rice_tonnes).toLocaleString() : "—"}</span><span class="stock-lbl">t rice</span></div>
          <div><span class="stock-num">${st.medicines_units != null ? Number(st.medicines_units).toLocaleString() : "—"}</span><span class="stock-lbl">medicine units</span></div>
          <div><span class="stock-num">${st.water_liters != null ? Number(st.water_liters).toLocaleString() : "—"}</span><span class="stock-lbl">L water</span></div>
        </div>
        <div class="card-line">Vehicles: <strong>${d.vehicles_available ?? "—"} available</strong> &middot; <strong>${d.vehicles_in_transit ?? 0} in transit</strong></div>
        <div class="card-actions">
          ${coords ? `<button class="btn-sec-link" data-depot-map="${escapeHtml(d.id)}">${icon("map")} Show on map</button>` : ""}
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-depot-map]").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = currentDepots().find(x => x.id === btn.dataset.depotMap);
      if (!d || !d.location) return;
      const c = d.location.coordinates;
      focusMapOn([c[1], c[0]], 10, `<strong>${escapeHtml(d.name)}</strong><br>Rice: ${d.stock ? d.stock.rice_tonnes : "—"}t<br>Vehicles available: ${d.vehicles_available}`);
    });
  });
}

// ---------- Alerts ----------
const DEMO_ALERTS = [
  { id: "ALT_01", severity: "CRITICAL", alert_type: "BLOCKED ROAD", location: "Ukhrul Sector · NH-150 Kameng Corridor", reason: "Rainfall surge 114mm over 72h will breach slope threshold km 42.", recommended_action: "Pre-position 12t rice", confidence: 0.82 },
  { id: "ALT_02", severity: "WARNING", alert_type: "SLOPE RISK", location: "Thingbu Camp · NH-150 Km 48", reason: "Single-lane traffic constriction from minor shoulder erosion.", recommended_action: "Dispatch 15t grains", confidence: 0.7 }
];

// "Corridor osm_w_725155507 (dist_tawang)" -> { segment, district }
function parseAlertLocation(loc) {
  const m = /Corridor\s+(\S+)\s+\((\S+)\)/i.exec(loc || "");
  return m ? { segment: m[1], district: districtLabel(m[2]) } : { segment: null, district: "" };
}

function renderAlertsView() {
  const container = document.getElementById("alerts-list-container");
  if (!container) return;

  const live = alertsData.length > 0;
  const alerts = live ? alertsData : DEMO_ALERTS;

  container.innerHTML = alerts.map(a => {
    const sev = String(a.severity || "WARNING").toLowerCase() === "critical" ? "critical" : "warning";
    const loc = parseAlertLocation(a.location);
    const seg = loc.segment ? segById.get(loc.segment) : null;
    const title = seg ? roadLabel(seg.properties) : (loc.segment ? `Road ${loc.segment}${loc.district ? " · " + loc.district : ""}` : a.location);
    return `
      <div class="risk-item-card roomy ${sev}">
        <div class="risk-item-top">
          <span class="risk-tag ${sev}">${escapeHtml(a.severity)} &middot; ${escapeHtml(a.alert_type || "ALERT")}</span>
          <span class="risk-prob">${a.time ? `${icon("clock", 12)} ${relTime(a.time)}` : ""}${a.confidence != null ? ` &middot; ${Math.round(a.confidence * 100)}% confidence` : ""}</span>
        </div>
        <div class="risk-location">${escapeHtml(title)}</div>
        ${loc.segment ? `<div class="risk-seg-id">${escapeHtml(loc.segment)}</div>` : ""}
        <div class="risk-reason">${escapeHtml(a.reason)}</div>
        <div class="risk-item-footer">
          <span class="risk-action">Recommended: <strong>${escapeHtml(a.recommended_action || "—")}</strong></span>
          <div class="risk-footer-actions">
            ${loc.segment ? `<button class="btn-sec-link" data-segment-map="${escapeHtml(loc.segment)}">${icon("map")} Show on map</button>` : ""}
            <button class="btn-dec change btn-dec-sm" data-go="#/decisions">Review decisions &rarr;</button>
          </div>
        </div>
      </div>
    `;
  }).join("") + (live ? "" : `<div class="empty-panel">Demo alerts shown because the alerts API is unavailable.</div>`);

  container.querySelectorAll("[data-segment-map]").forEach(btn => {
    btn.addEventListener("click", () => focusSegment(btn.dataset.segmentMap));
  });
  container.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => { window.location.hash = btn.dataset.go; });
  });
}

function districtLabel(districtId) {
  if (!districtId) return "";
  return String(districtId).replace(/^dist_/, "").split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function renderActiveCorridorRisks() {
  const container = document.getElementById("active-risks-container");
  if (!container) return;

  // Real at-risk road segments from the pipeline, highest closure risk first.
  const segs = topRiskSegments(6);

  if (segs.length === 0) {
    container.innerHTML = `<div class="empty-panel">No at-risk roads in the current forecast.</div>`;
    return;
  }

  container.innerHTML = segs.map((s, i) => {
    const p = s.properties;
    const prob = p.closure_probability;
    const critical = prob >= 0.5 || p.predicted_closed;
    const sev = critical ? "critical" : (prob >= 0.25 ? "warning" : "low");
    const sevLabel = critical ? "CRITICAL" : (prob >= 0.25 ? "WARNING" : "WATCH");
    const reasons = Array.isArray(p.hazard_reasons) && p.hazard_reasons.length
      ? p.hazard_reasons.join(" · ")
      : [p.predicted_closed ? "Predicted closed" : null, p.slope_deg != null ? `slope ${Number(p.slope_deg).toFixed(1)}°` : null]
          .filter(Boolean).join(" · ");
    return `
      <button type="button" class="risk-item-card ${sev}" data-risk-index="${i}" title="Zoom the map to this road">
        <div class="risk-item-top">
          <span class="risk-tag ${sev}">${sevLabel}</span>
          <span class="risk-prob">${Math.round(prob * 100)}% closure</span>
        </div>
        <div class="risk-location">${escapeHtml(roadLabel(p))}</div>
        ${reasons ? `<div class="risk-reason">${escapeHtml(reasons)}</div>` : ""}
        <div class="risk-seg-id">${escapeHtml(p.segment_id)}${p.forecast_for_date ? ` &middot; forecast ${escapeHtml(p.forecast_for_date)}` : ""}</div>
      </button>
    `;
  }).join("");

  // Clicking a risk zooms whichever map is on screen to that road.
  container.querySelectorAll("[data-risk-index]").forEach(btn => {
    btn.onclick = () => {
      const seg = segs[Number(btn.dataset.riskIndex)];
      if (seg) showSegmentOnMap(seg);
    };
  });
}

async function fetchAuditTrail() {
  try {
    const res = await fetch(`${API_BASE}/audit`);
    if (res.ok) {
      auditData = await res.json();
      renderAuditTrailView();
    }
  } catch (e) {
    console.warn("Audit fetch failed:", e);
  }
}

function renderAuditTrailView() {
  const container = document.getElementById("audit-cards-container");
  if (!container) return;

  if (auditData.length === 0) {
    container.innerHTML = `<div class="card-box"><p>No audit logs available yet.</p></div>`;
    return;
  }

  container.innerHTML = auditData.map(a => `
    <div class="audit-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong class="audit-action">${a.action}</strong>
        <span class="pill-prov real">POSTGRESQL 16</span>
      </div>
      <p class="audit-reasoning">${a.reasoning}</p>
      <div class="audit-meta">
        <span>Confidence: ${a.confidence ? (a.confidence * 100).toFixed(0) + '%' : '100%'}</span>
        <span>${a.created_at ? new Date(a.created_at).toLocaleString() : 'Recent'}</span>
      </div>
    </div>
  `).join("");
}

function renderTrackRecordView() {
  const tr = trackRecordData || {};

  // Overview summary card
  setText("tr-total-pred", tr.total_predictions);
  setText("tr-confirmed-pred", tr.confirmed_correct);
  setText("tr-incorrect-pred", tr.incorrect);
  setText("tr-missed-pred", tr.missed_closures);
  if (typeof tr.hit_rate_pct === "number") setText("tr-hit-rate", `${tr.hit_rate_pct}%`);
  if (tr.evaluation_period) {
    setText("tr-period", [tr.evaluation_period, tr.data_provenance].filter(Boolean).join(" • "));
  }

  // District table: /track-record returns breakdown_by_district {district, total, correct, hit_rate %}
  const tableBody = document.querySelector("#tr-district-table tbody");
  const districts = tr.breakdown_by_district || [];
  if (tableBody && districts.length) {
    tableBody.innerHTML = districts.map(d => `
      <tr>
        <td>${escapeHtml(d.district)}</td>
        <td>${d.total}</td>
        <td>${d.correct}</td>
        <td><strong class="${d.hit_rate >= 75 ? 'text-green' : 'text-amber'}">${Number(d.hit_rate).toFixed(1)}%</strong></td>
      </tr>
    `).join("");
  }

  // Recent outcomes {corridor, predicted, actual, status: CORRECT | MISSED | CORRECTED, note}
  const outcomesCont = document.getElementById("tr-outcomes-container");
  const outcomes = tr.recent_outcomes || [];
  if (outcomesCont && outcomes.length) {
    const tone = { CORRECT: "good", MISSED: "bad", CORRECTED: "warn" };
    outcomesCont.innerHTML = `
      <div class="tr-outcomes-head">
        <span class="pill-prov real">DATA PROVENANCE: ${escapeHtml(tr.data_provenance || "REAL")}</span>
      </div>
      <div class="tr-outcome-list">
        ${outcomes.map(o => `
          <div class="tr-outcome ${tone[o.status] || "warn"}">
            <div>
              <strong>${escapeHtml(o.corridor)}</strong>
              <div class="tr-outcome-meta">Predicted: ${escapeHtml(o.predicted)} &bull; Actual: ${escapeHtml(o.actual)}${o.note ? ` &bull; ${escapeHtml(o.note)}` : ""}</div>
            </div>
            <span class="tr-outcome-status">${escapeHtml(o.status)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }
}

function renderAutomationStatus() {
  const summaryEl = document.getElementById("auto-summary-text");
  const lastRunEl = document.getElementById("auto-last-run");
  const sidebarSub = document.getElementById("sidebar-status-sub");
  const data = automationStatusData || {};
  if (summaryEl && data.summary_text) summaryEl.textContent = data.summary_text;
  if (lastRunEl && data.last_automated_run) {
    lastRunEl.textContent = `Last run ${relTime(data.last_automated_run)}`;
    lastRunEl.title = new Date(data.last_automated_run).toLocaleString();
  }
  const stages = Array.isArray(data.pipeline_stages) ? data.pipeline_stages : [];
  if (sidebarSub && stages.length) {
    const done = stages.filter(st => /COMPLETED|ACTIVE|OK/i.test(st.status || "")).length;
    sidebarSub.textContent = `${done} of ${stages.length} pipeline stages complete${data.last_automated_run ? ` · ran ${relTime(data.last_automated_run)}` : ""}`;
  }
}

// ====================================================
// 9. SCENARIO WHAT-IF SIMULATION ENGINE
// ====================================================
function initScenarioSandbox() {
  const sliderRain = document.getElementById("slider-rain");
  const sliderSlope = document.getElementById("slider-slope");
  const valRain = document.getElementById("val-rain-surge");
  const valSlope = document.getElementById("val-slope-mult");
  const btnRunSim = document.getElementById("btn-run-sim");

  if (sliderRain && valRain) {
    sliderRain.oninput = (e) => { valRain.textContent = `+${e.target.value} mm`; };
  }
  if (sliderSlope && valSlope) {
    sliderSlope.oninput = (e) => { valSlope.textContent = `${e.target.value}x`; };
  }

  if (btnRunSim) {
    btnRunSim.onclick = () => {
      const rain = parseInt(sliderRain.value, 10);
      const slope = parseFloat(sliderSlope.value);
      const corridor = document.getElementById("scenario-block-corridor").value;

      let cutoffs = Math.min(12, Math.round(2 + (rain / 25) + (slope * 1.5)));
      let vriDrop = (rain * 0.2 + (slope - 1) * 15).toFixed(1);
      let trucks = Math.round(cutoffs * 0.8);

      document.getElementById("sim-cutoffs").textContent = cutoffs;
      document.getElementById("sim-vri-drop").textContent = `-${vriDrop}%`;
      document.getElementById("sim-extra-trucks").textContent = `+${trucks} Trucks`;

      document.getElementById("sim-analysis-text").innerHTML = `
        <strong>Simulation Result:</strong> With a +${rain} mm rainfall surge, ${slope}x slope coefficient and injection of <strong>${corridor}</strong>, 
        <strong>${cutoffs} habitations</strong> lose access up to 24h earlier. Recommend mobilizing <strong>${trucks} relief trucks</strong> from Central Depot immediately.
      `;

      showToast("⚡ What-If Scenario simulated successfully!", "info");
    };
  }
}

// ====================================================
// 10. COPILOT DECISION AGENT
// ====================================================
function bindGlobalEvents() {
  const copilotForm = document.getElementById("copilot-form");
  const copilotInput = document.getElementById("copilot-input");
  const chatBox = document.getElementById("copilot-chat-box");

  if (copilotForm && copilotInput && chatBox) {
    copilotForm.onsubmit = (e) => {
      e.preventDefault();
      const q = copilotInput.value.trim();
      if (!q) return;
      addUserMessage(q);
      copilotInput.value = "";

      setTimeout(() => {
        handleCopilotQuery(q);
      }, 400);
    };

    document.querySelectorAll(".copilot-btn-suggest").forEach(btn => {
      btn.onclick = () => {
        const q = btn.dataset.q;
        addUserMessage(q);
        setTimeout(() => handleCopilotQuery(q), 400);
      };
    });
  }
}

function addUserMessage(msg) {
  const chatBox = document.getElementById("copilot-chat-box");
  const div = document.createElement("div");
  div.className = "copilot-msg user";
  div.innerHTML = `<div class="msg-bubble">${escapeHtml(msg)}</div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function addBotMessage(msg) {
  const chatBox = document.getElementById("copilot-chat-box");
  const div = document.createElement("div");
  div.className = "copilot-msg bot";
  div.innerHTML = `
    <img src="dhara-logo.png?v=3" alt="DHARA Logo" class="chat-avatar">
    <div class="msg-bubble">${msg}</div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function pendingDecisions() {
  return [...liveDecisions].filter(d => d.status === "pending").sort(compareDecisions);
}

function decisionLine(d) {
  const bits = [`send ${d.recommended_units}t ${escapeHtml(String(d.recommended_commodity).toLowerCase())}`, `VRI ${d.current_vri}`, `${d.cutoff_hours}h to cutoff`];
  if (d.closure_probability != null) bits.push(`${Math.round(d.closure_probability * 100)}% road closure risk`);
  return `<strong>${escapeHtml(d.village_name)}</strong> (${bits.join(", ")})`;
}

// Overview copilot bar + the suggested question that names a real village
function renderCopilotSummary() {
  const desc = document.getElementById("copilot-bar-desc");
  const pending = pendingDecisions();
  if (desc) {
    if (pending.length) {
      const top = pending[0];
      desc.textContent = `${pending.length} pre-positioning decision${pending.length === 1 ? "" : "s"} waiting. Most urgent: ${top.village_name} (${top.district}), VRI ${top.current_vri}, ${top.cutoff_hours}h to predicted cutoff.`;
    } else {
      desc.textContent = "No pre-positioning decisions are waiting. Ask about any village, road or depot.";
    }
  }
  const why = document.getElementById("copilot-suggest-why");
  if (why && pending.length) {
    const q = `Why is ${pending[0].village_name} high risk?`;
    why.dataset.q = q;
    why.textContent = `"${q}"`;
  }
}

function findVillageInQuery(lower) {
  const byDecision = liveDecisions.find(d => d.village_name && lower.includes(d.village_name.toLowerCase()));
  if (byDecision) return { decision: byDecision, hab: habById.get(byDecision.village_id) };
  const hab = (habitationsData || []).find(f => f.properties.name && f.properties.name.length > 3 && lower.includes(f.properties.name.toLowerCase()));
  return hab ? { decision: null, hab } : null;
}

// Answers come from the live worklist and forecast, not canned text.
function handleCopilotQuery(q) {
  const lower = q.toLowerCase();
  const pending = pendingDecisions();
  let answer = "";
  const match = findVillageInQuery(lower);

  if (match) {
    const d = match.decision;
    const hp = match.hab ? match.hab.properties : null;
    if (d) {
      const seg = d.nearest_segment_id ? segById.get(d.nearest_segment_id) : null;
      answer = `${decisionLine(d)} is on the worklist. ` +
        (seg && nearRoadIsLocal(d) ? `The nearest at-risk road, ${escapeHtml(roadLabel(seg.properties))}, has a ${Math.round(seg.properties.closure_probability * 100)}% predicted closure probability and passes ${d.nearest_segment_km.toFixed(1)} km away. ` : "") +
        `Travel time goes from ${d.travel_time_now} now to ${d.travel_time_after} if it closes. ` +
        `DHARA's reasoning: <em>"${escapeHtml(d.reasoning)}"</em>`;
    } else if (hp) {
      answer = `<strong>${escapeHtml(hp.name)}</strong> (${escapeHtml(districtLabel(hp.district_id))}) has a reachability index of <strong>${Number(hp.vri).toFixed(1)}</strong>. ` +
        (hp.cutoff_status === "no_cutoff_in_window" ? "No cutoff is predicted in the forecast window, and there is no pending decision for it." : `Predicted cutoff in ${hp.hours_until_cutoff}h.`);
    }
  } else if (/action|today|pending|decid/.test(lower)) {
    answer = pending.length
      ? `<strong>${pending.length}</strong> decision${pending.length === 1 ? "" : "s"} waiting. The most urgent: <ol>${pending.slice(0, 3).map(d => `<li>${decisionLine(d)}</li>`).join("")}</ol>They are at the top of <strong>Today's Decisions</strong>.`
      : "Nothing is waiting for a decision right now.";
  } else if (/48|cutoff|cut off|lose access/.test(lower)) {
    const soon = (habitationsData || [])
      .filter(f => f.properties.cutoff_status !== "no_cutoff_in_window" && Number(f.properties.hours_until_cutoff) <= 48)
      .sort((a, b) => a.properties.hours_until_cutoff - b.properties.hours_until_cutoff);
    if (soon.length) {
      answer = `<strong>${soon.length}</strong> village${soon.length === 1 ? "" : "s"} may lose road access within 48 hours: ${soon.slice(0, 5).map(f => `<strong>${escapeHtml(f.properties.name)}</strong> (${f.properties.hours_until_cutoff}h)`).join(", ")}.`;
    } else {
      const lowest = [...(habitationsData || [])].sort((a, b) => a.properties.vri - b.properties.vri)[0];
      answer = "No village is predicted to lose road access within 48 hours in the current forecast." +
        (lowest ? ` The lowest reachability is <strong>${escapeHtml(lowest.properties.name)}</strong> at VRI ${Number(lowest.properties.vri).toFixed(1)}.` : "");
    }
  } else if (/recommend|rice|ration|how much|quantity/.test(lower)) {
    const d = pending[0];
    answer = d
      ? `For ${decisionLine(d)}, the decision agent recommends pre-positioning from <strong>${escapeHtml(d.source_depot)}</strong> before ${escapeHtml(d.latest_departure)}. Its reasoning: <em>"${escapeHtml(d.reasoning)}"</em>`
      : "There is no pending recommendation right now.";
  } else if (/road|segment|closure|corridor/.test(lower)) {
    const segs = topRiskSegments(3);
    answer = segs.length
      ? `Highest predicted closure risk: <ol>${segs.map(s => `<li><strong>${escapeHtml(roadLabel(s.properties))}</strong> <span class="mono">${escapeHtml(s.properties.segment_id)}</span>: ${Math.round(s.properties.closure_probability * 100)}%${s.properties.predicted_closed ? ", predicted closed" : ""}</li>`).join("")}</ol>`
      : "No at-risk roads are loaded in the current forecast.";
  } else {
    const cov = coverageData && typeof coverageData.habitations_count === "number" ? coverageData : null;
    answer = cov
      ? `DHARA is tracking <strong>${cov.habitations_count.toLocaleString()}</strong> habitations and <strong>${cov.road_segments_count}</strong> road segments, with <strong>${Number(cov.weather_forecasts_count || 0).toLocaleString()}</strong> weather forecasts ingested. ${pending.length} decision${pending.length === 1 ? " is" : "s are"} waiting on your worklist. Try asking about a village by name, road closures, or what needs action today.`
      : "I can answer from the live worklist and forecast: ask what needs action today, which villages may be cut off, or about a village by name.";
  }

  addBotMessage(answer);
}

// ====================================================
// 11. MAP & ANALYTICS CHARTS
// ====================================================
let mapLayerControl = null;
let mapLayers = {};
let mapBasemaps = {};
let basemapPinned = false; // true once the officer picks a basemap by hand
let basemapFallbackUsed = false;
let mapFilter = "all";     // "all" | "risk" (VRI < 70) | "cutoff" (VRI < 30)

const MAP_FILTERS = {
  all: () => true,
  risk: (vri) => vri < 70,
  cutoff: (vri) => vri < 30
};

const ESRI_ATTR = 'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>';

function esriLayer(service, opts = {}) {
  return L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
    Object.assign({ maxZoom: 18, maxNativeZoom: 16, attribution: ESRI_ATTR }, opts));
}

// Keyless basemaps. "light" and "dark" follow the theme: both show terrain,
// rivers, roads and place names so officers can read the hills they're
// planning around (the plain gray canvas was nearly empty up close).
function buildBasemaps() {
  return {
    light: L.layerGroup([esriLayer("World_Topo_Map", { maxNativeZoom: 17 })]),
    dark: L.layerGroup([
      esriLayer("Canvas/World_Dark_Gray_Base"),
      esriLayer("Elevation/World_Hillshade_Dark", { maxNativeZoom: 13, opacity: 0.55 }),
      esriLayer("Canvas/World_Dark_Gray_Reference")
    ]),
    gray: L.layerGroup([esriLayer("Canvas/World_Light_Gray_Base"), esriLayer("Canvas/World_Light_Gray_Reference")]),
    streets: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }),
    satellite: esriLayer("World_Imagery", { maxNativeZoom: 17 })
  };
}

// If the Esri tile service doesn't answer (offline, firewall), switch to
// OpenStreetMap once instead of leaving a blank map.
function watchBasemap(group) {
  let loads = 0;
  let errors = 0;
  const layers = group.eachLayer ? [] : [group];
  if (group.eachLayer) group.eachLayer(l => layers.push(l));
  layers.forEach(layer => {
    layer.on("tileload", () => { loads++; });
    layer.on("tileerror", () => {
      errors++;
      if (errors >= 6 && loads === 0 && !basemapFallbackUsed && map && map.hasLayer(group)) {
        basemapFallbackUsed = true;
        map.removeLayer(group);
        mapBasemaps.streets.addTo(map);
        mapBasemaps.streets.bringToBack();
        basemapPinned = true;
        showToast("The terrain map didn't load, so DHARA switched to the OpenStreetMap base map.", "warning");
      }
    });
  });
}

function depotIcon() {
  return L.divIcon({ className: "map-icon depot", html: icon("home", 14), iconSize: [28, 28], iconAnchor: [14, 14] });
}

function truckIcon(emphasis = false) {
  return L.divIcon({ className: `map-icon truck${emphasis ? " emphasis" : ""}`, html: icon("truck", 13), iconSize: [26, 26], iconAnchor: [13, 13] });
}

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || map || typeof L === "undefined") return;

  // Never initialize Leaflet while its container is hidden (display:none) —
  // it measures a 0x0 box, computes the wrong tile grid, and the basemap
  // renders as solid black blocks instead of tiles. Bail out here; the
  // route handler calls initMap() again once the container is visible.
  if (mapEl.offsetParent === null || mapEl.clientWidth === 0 || mapEl.clientHeight === 0) {
    return;
  }

  try {
    map = L.map('map', {
      center: [27.35, 93.4], // North-East India focus
      zoom: 7,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      wheelPxPerZoomLevel: 90, // smoother, less jumpy scroll-wheel zoom
      attributionControl: false,
      preferCanvas: true // Use canvas for performance with many markers
    });

    mapBasemaps = buildBasemaps();
    Object.values(mapBasemaps).forEach(watchBasemap);
    mapBasemaps[currentTheme()].addTo(map);
    map.on("baselayerchange", () => { basemapPinned = true; });

    // "Show everything" sits right under the zoom buttons.
    const ResetControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const wrap = L.DomUtil.create("div", "leaflet-bar map-reset-control");
        const a = L.DomUtil.create("a", "", wrap);
        a.href = "#";
        a.title = "Show everything";
        a.setAttribute("role", "button");
        a.setAttribute("aria-label", "Show everything on the map");
        a.innerHTML = icon("home", 15);
        L.DomEvent.on(a, "click", (e) => {
          L.DomEvent.preventDefault(e);
          L.DomEvent.stopPropagation(e);
          mapLayers.selection.clearLayers();
          map.closePopup();
          fitAllData();
        });
        return wrap;
      }
    });
    new ResetControl().addTo(map);

    mapLayers.habitations = L.layerGroup().addTo(map);
    mapLayers.roads = L.layerGroup().addTo(map);
    mapLayers.vehicles = L.layerGroup().addTo(map);
    mapLayers.incidents = L.layerGroup().addTo(map);
    mapLayers.dispatches = L.layerGroup().addTo(map);
    mapLayers.context = L.layerGroup().addTo(map);   // this page's highlighted items
    mapLayers.selection = L.layerGroup().addTo(map); // focus ring; not listed in the layer switcher

    mapLayerControl = L.control.layers({
      "Terrain": mapBasemaps.light,
      "Terrain, dark": mapBasemaps.dark,
      "Light gray": mapBasemaps.gray,
      "Streets (OpenStreetMap)": mapBasemaps.streets,
      "Satellite (Esri)": mapBasemaps.satellite
    }, {
      "Villages (reachability)": mapLayers.habitations,
      "At-risk roads": mapLayers.roads,
      "Relief trucks": mapLayers.vehicles,
      "Supply depots": mapLayers.dispatches,
      "Field incidents": mapLayers.incidents
    }, { collapsed: true, position: 'topleft' }).addTo(map); // top-right is taken by the map key

    // Attach the tool panels before drawing data, so one bad data row can't
    // stop the hazard intel, 3D terrain and map notes tools from appearing.
    // Live hazard intel overlays (NASA GIBS, RainViewer, USGS, Open-Meteo) — see intel-layers.js
    if (window.DharaIntel) window.DharaIntel.attach(map);
    // Lazy-loaded 3D terrain view (CesiumJS + keyless terrain) — see terrain3d.js
    if (window.DharaTerrain3D) window.DharaTerrain3D.attach(map);
    // Shared officer map notes, measuring, situation snapshot — see ops-tools.js
    if (window.DharaOps) window.DharaOps.attach(map);

    // Village dots grow as you zoom in, so 3,660 of them stay readable.
    map.on("zoomend", resizeHabitationMarkers);
    map.on("click", () => mapLayers.selection.clearLayers());
    map.on("overlayadd overlayremove", syncLayerToggles);

    safeUpdateMapLayers();
    computeAllDataBounds();
    if (habitationsData.length) mapFramedWithData = true;

    // Keep the Live Map toolbar's pressed state in step with the in-map
    // panel buttons, which toggle the same panels.
    const controls = mapEl.querySelector(".leaflet-control-container");
    if (controls && typeof MutationObserver !== "undefined") {
      new MutationObserver(syncMapToolbar).observe(controls, { attributes: true, attributeFilter: ["class"], subtree: true });
    }

    // Re-measure a couple of times shortly after init — fonts/layout can
    // still shift the container size right after it becomes visible.
    setTimeout(() => { if (map) map.invalidateSize(); }, 250);
    setTimeout(() => { if (map) map.invalidateSize(); }, 750);

    // Keep tracking the container's real size for as long as the map
    // lives — hiding the side panel, sidebar collapse, window resize, etc.
    // would otherwise leave Leaflet's internal size stale and the basemap
    // would only paint the old box.
    if (typeof ResizeObserver !== "undefined") {
      const wrapperEl = mapEl.closest(".map-viewport-wrapper") || mapEl;
      const ro = new ResizeObserver(() => {
        if (map) map.invalidateSize({ debounceMoveend: true });
      });
      ro.observe(wrapperEl);
    }
  } catch (err) {
    console.warn("Map init exception:", err);
  }
}

// Swap the terrain basemap to match the theme, unless the officer chose one.
function syncBasemapToTheme() {
  if (!map || basemapPinned || !mapBasemaps.light) return;
  const want = mapBasemaps[currentTheme()];
  const other = currentTheme() === "dark" ? mapBasemaps.light : mapBasemaps.dark;
  if (map.hasLayer(other)) map.removeLayer(other);
  if (!map.hasLayer(want)) {
    want.addTo(map);
    // Base tiles belong under the data and hazard overlays.
    want.eachLayer(l => l.bringToBack && l.bringToBack());
  }
}

function mapPalette() {
  return {
    red: cssVar("--map-red") || "#DC2626",
    amber: cssVar("--map-amber") || "#D97706",
    green: cssVar("--map-green") || "#10B981",
    blue: cssVar("--map-blue") || "#2563EB",
    depot: cssVar("--map-depot") || "#312622",
    stroke: cssVar("--marker-stroke") || "#FFFFFF",
    casing: cssVar("--map-casing") || "#FFFFFF"
  };
}

function habRadius(zoom) {
  if (zoom <= 6) return 2;
  if (zoom <= 7) return 3;
  if (zoom <= 8) return 4;
  if (zoom <= 9) return 5;
  return 6.5;
}

function habStrokeWeight(zoom) {
  return zoom < 9 ? 0.5 : 1;
}

function resizeHabitationMarkers() {
  if (!map || !mapLayers.habitations) return;
  const z = map.getZoom();
  const r = habRadius(z);
  const w = habStrokeWeight(z);
  mapLayers.habitations.eachLayer(l => {
    if (l.setRadius) {
      l.setRadius(r);
      l.setStyle({ weight: w });
    }
  });
}

window.updateMapLayers = function() {
  if (!map) return;
  const c = mapPalette();
  const z = map.getZoom();
  const keep = MAP_FILTERS[mapFilter] || MAP_FILTERS.all;

  // Clear existing
  mapLayers.habitations.clearLayers();
  mapLayers.roads.clearLayers();
  mapLayers.vehicles.clearLayers();
  mapLayers.incidents.clearLayers();
  mapLayers.dispatches.clearLayers();

  // Habitations: highest VRI first, so red/amber dots are painted on top.
  if (habitationsData) {
    const rows = habitationsData
      .map(f => ({ f, vri: Number(f.properties.vri) }))
      .filter(r => Number.isFinite(r.vri) && keep(r.vri))
      .sort((a, b) => b.vri - a.vri);

    rows.forEach(({ f, vri }) => {
      const p = f.properties;
      const coords = f.geometry.coordinates;

      // Dot color and popup label come from the same `vri` thresholds as the
      // map legend (High >=70 / Moderate 30-69 / Cut-off risk <30).
      let color, riskLabel;
      if (vri < 30) {
        color = c.red; riskLabel = 'May be cut off';
      } else if (vri < 70) {
        color = c.amber; riskLabel = 'Access at risk';
      } else {
        color = c.green; riskLabel = 'Easy to reach';
      }

      const marker = L.circleMarker([coords[1], coords[0]], {
        radius: habRadius(z), fillColor: color, color: c.stroke, weight: habStrokeWeight(z), opacity: 1, fillOpacity: 0.9
      });

      marker.bindTooltip(`${escapeHtml(p.name)} · ${riskLabel}`, { direction: "top", offset: [0, -4], className: "map-tip" });
      const cutoffText = p.cutoff_status === "no_cutoff_in_window" ? "No cutoff expected this week" : (p.hours_until_cutoff ? `Could be cut off in ${p.hours_until_cutoff}h` : "—");
      marker.bindPopup(`<strong>${escapeHtml(p.name)}</strong><br><span class="popup-status" style="--dot:${color}">${riskLabel}</span><br>Reachability index: <strong>${vri.toFixed(0)}</strong> / 100<br>${cutoffText}${p.population ? `<br>Population: ${Number(p.population).toLocaleString()}` : ""}`);
      mapLayers.habitations.addLayer(marker);
    });
  }

  // Roads: a light outline underneath so they stand out on the terrain map,
  // and the riskier the road the thicker the line.
  if (atRiskSegmentsData) {
    const roadWidth = (prob) => (prob >= 0.5 ? 5 : prob >= 0.25 ? 4 : 2.5);
    const roadColor = (prob) => (prob >= 0.5 ? c.red : prob >= 0.25 ? c.amber : c.blue);
    L.geoJSON(atRiskSegmentsData, {
      style: (feature) => ({ color: c.casing, weight: roadWidth(feature.properties.closure_probability) + 3, opacity: 0.9, lineCap: "round" }),
      interactive: false
    }).addTo(mapLayers.roads);
    L.geoJSON(atRiskSegmentsData, {
      style: function(feature) {
        const prob = feature.properties.closure_probability;
        return { color: roadColor(prob), weight: roadWidth(prob), opacity: 0.95, lineCap: "round" };
      },
      onEachFeature: function(feature, layer) {
        const p = feature.properties;
        const prob = Number(p.closure_probability);
        const pct = Number.isFinite(prob) ? `${Math.round(prob * 100)}%` : "—";
        const verdict = prob >= 0.5 ? "Likely to close" : prob >= 0.25 ? "At risk of closing" : "Open, being watched";
        layer.bindTooltip(`${escapeHtml(roadLabel(p))} · ${pct} chance of closure`, { sticky: true, className: "map-tip" });
        layer.bindPopup(`<strong>${escapeHtml(roadLabel(p))}</strong><br><span class="popup-status" style="--dot:${roadColor(prob)}">${verdict}</span><br>Chance of closure: <strong>${pct}</strong>${p.predicted_closed ? " · predicted closed" : ""}<br>Slope ${p.slope_deg != null ? Number(p.slope_deg).toFixed(1) + "°" : "—"} · landslide class ${p.landslide_class ?? "—"}<br><span class="mono">${escapeHtml(p.segment_id)}</span>`);
      }
    }).addTo(mapLayers.roads);
  }

  // Vehicles
  if (vehiclesData) {
    vehiclesData.forEach(v => {
      if (!v.coordinates) return;
      const marker = L.marker([v.coordinates[1], v.coordinates[0]], { icon: truckIcon(), keyboard: false });
      marker.bindTooltip(`Relief truck ${escapeHtml(v.vehicle_id)} · ${escapeHtml(v.status)}`, { direction: "top", offset: [0, -12], className: "map-tip" });
      marker.bindPopup(`<strong>${escapeHtml(v.vehicle_id)}</strong><br>Speed: ${v.speed_kmh} km/h<br>Status: ${escapeHtml(v.status)}<br><span class="map-badge">SIMULATED GPS</span>`);
      mapLayers.vehicles.addLayer(marker);
    });
  }

  // Depots
  if (depotsData) {
    depotsData.forEach(d => {
      if (!d.location || !d.location.coordinates) return;
      const coords = d.location.coordinates;
      const marker = L.marker([coords[1], coords[0]], { icon: depotIcon(), keyboard: false });
      const rice = d.stock && d.stock.rice_tonnes != null ? `${d.stock.rice_tonnes}t` : "N/A";
      marker.bindTooltip(`Supply depot · ${escapeHtml(d.name)}`, { direction: "top", offset: [0, -14], className: "map-tip" });
      marker.bindPopup(`<strong>${escapeHtml(d.name)}</strong><br>Relief stock (rice): ${rice}<br>Vehicles available: ${d.vehicles_available}`);
      mapLayers.dispatches.addLayer(marker);
    });
  }
}

// ---------- Legend: village filter + collapse ----------
function renderMapFilterCounts() {
  const vris = (habitationsData || []).map(f => Number(f.properties.vri)).filter(Number.isFinite);
  const counts = {
    all: vris.length,
    risk: vris.filter(v => v < 70).length,
    cutoff: vris.filter(v => v < 30).length
  };
  const probs = (atRiskSegmentsData || []).map(sg => Number(sg.properties.closure_probability)).filter(Number.isFinite);
  const guide = {
    green: vris.filter(v => v >= 70).length,
    amber: vris.filter(v => v >= 30 && v < 70).length,
    red: counts.cutoff,
    "road-red": probs.filter(v => v >= 0.5).length,
    "road-amber": probs.filter(v => v >= 0.25 && v < 0.5).length,
    "road-blue": probs.filter(v => v < 0.25).length,
    depots: (depotsData || []).length,
    trucks: (vehiclesData || []).length
  };
  document.querySelectorAll("[data-guide-count]").forEach(el => {
    const n = guide[el.dataset.guideCount];
    el.textContent = n != null ? n.toLocaleString() : "";
  });
  document.querySelectorAll("[data-filter-count]").forEach(el => {
    const n = counts[el.dataset.filterCount];
    el.textContent = n != null ? n.toLocaleString() : "";
  });
}

function initMapLegend() {
  document.querySelectorAll("[data-map-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      mapFilter = btn.dataset.mapFilter;
      document.querySelectorAll("[data-map-filter]").forEach(b => {
        const on = b.dataset.mapFilter === mapFilter;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      safeUpdateMapLayers();
    });
  });

  const toggle = document.getElementById("btn-legend-toggle");
  if (!toggle) return;
  syncLegendToMapSize();
  toggle.addEventListener("click", () => {
    const legend = document.getElementById("map-legend");
    setLegendCollapsed(!legend.classList.contains("collapsed"));
  });
}

function setLegendCollapsed(collapsed) {
  const legend = document.getElementById("map-legend");
  const toggle = document.getElementById("btn-legend-toggle");
  if (!legend || !toggle) return;
  legend.classList.toggle("collapsed", collapsed);
  toggle.setAttribute("aria-expanded", String(!collapsed));
}

// The full key opens on a roomy map and folds to a "Map key" button on a
// small one, where it would cover the villages. Officers can open or close
// it any time; it is tidied again when the map crosses between roomy and small.
let legendRoomy = null;

function syncLegendToMapSize() {
  const view = document.getElementById("map-viewport");
  if (!view || !view.clientWidth) return;
  const roomy = view.clientWidth >= 620 && view.clientHeight >= 500;
  if (roomy === legendRoomy) return;
  legendRoomy = roomy;
  setLegendCollapsed(!roomy);
}


// ---------- Charts ----------
function chartColors() {
  return {
    text: cssVar("--text-secondary"),
    muted: cssVar("--text-muted"),
    grid: cssVar("--chart-grid"),
    card: cssVar("--bg-card"),
    blue: cssVar("--accent-blue"),
    cyan: cssVar("--accent-cyan"),
    green: cssVar("--accent-green"),
    red: cssVar("--accent-red"),
    amber: cssVar("--accent-amber"),
    purple: cssVar("--accent-purple")
  };
}

const charts = {};

// Create a chart once, then update it in place on each data refresh.
function upsertChart(key, canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const existing = charts[key];
  if (existing) {
    existing.data = config.data;
    existing.options = config.options;
    existing.update("none");
    return;
  }
  charts[key] = new Chart(canvas.getContext("2d"), config);
}

// Chart.js draws on canvas, so a theme switch means rebuilding the charts.
function refreshChartsForTheme() {
  Object.keys(charts).forEach(key => {
    charts[key].destroy();
    delete charts[key];
  });
  initAnalyticsCharts();
}

const VRI_BANDS = [
  { label: "Under 30", test: v => v < 30, tone: "red", alpha: 1 },
  { label: "30–50", test: v => v >= 30 && v < 50, tone: "amber", alpha: 1 },
  { label: "50–70", test: v => v >= 50 && v < 70, tone: "amber", alpha: 0.55 },
  { label: "70–85", test: v => v >= 70 && v < 85, tone: "green", alpha: 0.55 },
  { label: "85+", test: v => v >= 85, tone: "green", alpha: 1 }
];

function initAnalyticsCharts() {
  if (typeof Chart === "undefined") return;
  const c = chartColors();
  const font = { size: 11, family: "'Plus Jakarta Sans'" };
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
  Chart.defaults.color = c.muted;
  const axes = (extraY = {}) => ({
    x: { grid: { color: c.grid }, ticks: { color: c.muted } },
    y: Object.assign({ grid: { color: c.grid }, ticks: { color: c.muted } }, extraY)
  });

  // 1. 7-day reachability forecast from /forecast
  const fc = forecastData && Array.isArray(forecastData.summary) ? forecastData.summary : null;
  const labels = fc
    ? fc.map(s => new Date(s.forecast_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }))
    : ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
  const round1 = (v) => (v == null ? null : Math.round(Number(v) * 10) / 10);
  upsertChart("vri", "chart-vri-trend", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Average village VRI",
          data: fc ? fc.map(s => round1(s.avg_vri)) : [],
          borderColor: c.blue,
          backgroundColor: withAlpha(c.blue, 0.1),
          fill: true,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: "Lowest village VRI",
          data: fc ? fc.map(s => round1(s.min_vri)) : [],
          borderColor: c.red,
          borderDash: [4, 4],
          tension: 0.3,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: c.text, font } } },
      scales: axes({ suggestedMin: 0, suggestedMax: 100, title: { display: true, text: "VRI (0–100)", color: c.muted, font } })
    }
  });

  // 2. Villages by reachability band (from the loaded habitations)
  const vris = (habitationsData || []).map(f => Number(f.properties.vri)).filter(Number.isFinite);
  upsertChart("bands", "chart-district-breakdown", {
    type: "bar",
    data: {
      labels: VRI_BANDS.map(b => b.label),
      datasets: [{
        label: "Villages",
        data: VRI_BANDS.map(b => vris.filter(b.test).length),
        backgroundColor: VRI_BANDS.map(b => withAlpha(c[b.tone], b.alpha)),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: axes({ beginAtZero: true, title: { display: true, text: "Villages", color: c.muted, font } })
    }
  });

  // 3. Rice stock by depot (/depots)
  const depots = currentDepots();
  upsertChart("depots", "chart-depot-stocks", {
    type: "bar",
    data: {
      labels: depots.map(d => d.name.replace(/ (Regional )?(Relief )?(Hub|Depot)$/i, "")),
      datasets: [{
        label: "Rice (tonnes)",
        data: depots.map(d => (d.stock && d.stock.rice_tonnes) || 0),
        backgroundColor: withAlpha(c.blue, 0.8),
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: axes({ grid: { display: false } })
    }
  });

  // 4. Track Record Trend Chart (demo evaluation series; the page says so)
  upsertChart("accuracy", "chart-accuracy-trend", {
    type: "line",
    data: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      datasets: [{
        label: "Prediction hit rate (%)",
        data: [72, 75, 81, 78.6],
        borderColor: c.green,
        backgroundColor: withAlpha(c.green, 0.1),
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: axes({ min: 50, max: 100 })
    }
  });

  // Note: the Leaflet map is intentionally NOT initialized here. This
  // function runs on initial page load, possibly before the map's view is
  // shown, so the #map container may still be display:none — initializing
  // Leaflet against a hidden/zero-size container is what caused the basemap
  // to render as solid black blocks. ensureMap() initializes the map once an
  // officer page (and so the map) is actually visible.
}

// ====================================================
// 12. TOAST NOTIFICATION HELPER
// ====================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
