// nounDict.js - DeutschLens Built-in German Noun Dictionary
// Gender codes: 'm' = Maskulinum (der), 'f' = Femininum (die), 'n' = Neutrum (das)
// ~400 häufige deutsche Substantive für sofortiges Offline-Highlighting

const GERMAN_NOUNS = {
  // ── A ──────────────────────────────────────────────────────────
  "Abend": "m",        // evening
  "Abfall": "m",       // waste, garbage
  "Abhängigkeit": "f", // dependency
  "Abteilung": "f",    // department
  "Adresse": "f",      // address
  "Affe": "m",         // monkey
  "Aktion": "f",       // action, campaign
  "Aktie": "f",        // share (stock)
  "Alter": "n",        // age
  "Amt": "n",          // office, authority
  "Anfang": "m",       // beginning
  "Angebot": "n",      // offer
  "Angst": "f",        // fear
  "Antwort": "f",      // answer
  "Apfel": "m",        // apple
  "Arbeit": "f",       // work
  "Arbeiter": "m",     // worker
  "Arzt": "m",         // doctor
  "Aufgabe": "f",      // task
  "Auge": "n",         // eye
  "Auto": "n",         // car

  // ── B ──────────────────────────────────────────────────────────
  "Bahnhof": "m",      // train station
  "Banane": "f",       // banana
  "Bank": "f",         // bank / bench
  "Baum": "m",         // tree
  "Bein": "n",         // leg
  "Beispiel": "n",     // example
  "Berg": "m",         // mountain
  "Bericht": "m",      // report
  "Beruf": "m",        // profession
  "Beschluss": "m",    // decision, resolution
  "Bett": "n",         // bed
  "Bevölkerung": "f",  // population
  "Bier": "n",         // beer
  "Bild": "n",         // picture
  "Blume": "f",        // flower
  "Boden": "m",        // floor, ground
  "Brief": "m",        // letter
  "Brücke": "f",       // bridge
  "Brot": "n",         // bread
  "Bruder": "m",       // brother
  "Buch": "n",         // book
  "Bundesregierung": "f", // federal government
  "Bundestag": "m",    // German parliament
  "Butter": "f",       // butter

  // ── C ──────────────────────────────────────────────────────────
  "Computer": "m",     // computer

  // ── D ──────────────────────────────────────────────────────────
  "Dach": "n",         // roof
  "Demokratie": "f",   // democracy
  "Dorf": "n",         // village

  // ── E ──────────────────────────────────────────────────────────
  "Ei": "n",           // egg
  "Einigung": "f",     // agreement
  "Elefant": "m",      // elephant
  "Ende": "n",         // end
  "Entscheidung": "f", // decision
  "Entwicklung": "f",  // development
  "Erde": "f",         // earth
  "Erfahrung": "f",    // experience
  "Ergebnis": "n",     // result
  "Erklärung": "f",    // explanation
  "Euro": "m",         // euro

  // ── F ──────────────────────────────────────────────────────────
  "Familie": "f",      // family
  "Farbe": "f",        // color
  "Feuer": "n",        // fire
  "Finger": "m",       // finger
  "Fisch": "m",        // fish
  "Flasche": "f",      // bottle
  "Flughafen": "m",    // airport
  "Flüchtling": "m",   // refugee
  "Fluss": "m",        // river
  "Foto": "n",         // photo
  "Frage": "f",        // question
  "Frau": "f",         // woman / Mrs.
  "Frieden": "m",      // peace
  "Freund": "m",       // friend (male)
  "Freundin": "f",     // friend (female)
  "Frosch": "m",       // frog
  "Fuchs": "m",        // fox
  "Fuß": "m",          // foot

  // ── G ──────────────────────────────────────────────────────────
  "Garten": "m",       // garden
  "Gebäude": "n",      // building
  "Gedanke": "m",      // thought
  "Gefühl": "n",       // feeling
  "Geld": "n",         // money
  "Gemüse": "n",       // vegetables
  "Gericht": "n",      // court / dish
  "Gesetz": "n",       // law
  "Geschichte": "f",   // history / story
  "Gesellschaft": "f", // society
  "Gesicht": "n",      // face
  "Gesundheit": "f",   // health
  "Glück": "n",        // luck / happiness
  "Gott": "m",         // god
  "Gras": "n",         // grass
  "Grenze": "f",       // border
  "Grund": "m",        // reason, ground
  "Gruppe": "f",       // group

  // ── H ──────────────────────────────────────────────────────────
  "Haar": "n",         // hair
  "Hahn": "m",         // rooster / faucet
  "Hand": "f",         // hand
  "Handy": "n",        // mobile phone
  "Haushalt": "m",     // household / budget
  "Hase": "m",         // rabbit
  "Haus": "n",         // house
  "Herz": "n",         // heart
  "Himmel": "m",       // sky, heaven
  "Hotel": "n",        // hotel
  "Hund": "m",         // dog
  "Huhn": "n",         // chicken

  // ── I ──────────────────────────────────────────────────────────
  "Idee": "f",         // idea
  "Industrie": "f",    // industry
  "Information": "f",  // information

  // ── J ──────────────────────────────────────────────────────────
  "Jahr": "n",         // year
  "Jahrzehnt": "n",    // decade
  "Junge": "m",        // boy

  // ── K ──────────────────────────────────────────────────────────
  "Käse": "m",         // cheese
  "Kanzler": "m",      // chancellor
  "Kartoffel": "f",    // potato
  "Katze": "f",        // cat
  "Kind": "n",         // child
  "Kirche": "f",       // church
  "Klasse": "f",       // class
  "Klima": "n",        // climate
  "Kopf": "m",         // head
  "Krankenhaus": "n",  // hospital
  "Krise": "f",        // crisis
  "Krieg": "m",        // war
  "Küche": "f",        // kitchen
  "Kuchen": "m",       // cake
  "Kuh": "f",          // cow
  "Kultur": "f",       // culture
  "Kunde": "m",        // customer

  // ── L ──────────────────────────────────────────────────────────
  "Land": "n",         // country / land
  "Lampe": "f",        // lamp
  "Leben": "n",        // life
  "Lehrer": "m",       // teacher (male)
  "Lehrerin": "f",     // teacher (female)
  "Lösung": "f",       // solution
  "Löwe": "m",         // lion
  "Luft": "f",         // air

  // ── M ──────────────────────────────────────────────────────────
  "Mädchen": "n",      // girl
  "Mann": "m",         // man / husband
  "Markt": "m",        // market
  "Maßnahme": "f",     // measure
  "Meer": "n",         // sea, ocean
  "Mensch": "m",       // person, human
  "Milch": "f",        // milk
  "Minister": "m",     // minister
  "Minute": "f",       // minute
  "Mond": "m",         // moon
  "Monat": "m",        // month
  "Morgen": "m",       // morning / tomorrow
  "Mutter": "f",       // mother
  "Maus": "f",         // mouse

  // ── N ──────────────────────────────────────────────────────────
  "Nacht": "f",        // night
  "Nase": "f",         // nose
  "Nation": "f",       // nation
  "Natur": "f",        // nature
  "Nudel": "f",        // noodle

  // ── O ──────────────────────────────────────────────────────────
  "Obst": "n",         // fruit
  "Ohr": "n",          // ear
  "Orange": "f",       // orange
  "Ort": "m",          // place, location

  // ── P ──────────────────────────────────────────────────────────
  "Parlament": "n",    // parliament
  "Park": "m",         // park
  "Partei": "f",       // party (political)
  "Person": "f",       // person
  "Pferd": "n",        // horse
  "Platz": "m",        // square, place, seat
  "Politik": "f",      // politics
  "Polizei": "f",      // police
  "Präsident": "m",    // president
  "Preis": "m",        // price / prize
  "Problem": "n",      // problem
  "Prozent": "n",      // percent

  // ── R ──────────────────────────────────────────────────────────
  "Ratte": "f",        // rat
  "Regen": "m",        // rain
  "Regierung": "f",    // government
  "Restaurant": "n",   // restaurant
  "Rücken": "m",       // back (body)

  // ── S ──────────────────────────────────────────────────────────
  "Sache": "f",        // thing, matter
  "Schule": "f",       // school
  "Schlange": "f",     // snake / queue
  "Schlüssel": "m",    // key
  "Schnee": "m",       // snow
  "Schrank": "m",      // cabinet, wardrobe
  "Schwein": "n",      // pig
  "Schwester": "f",    // sister
  "Sekunde": "f",      // second
  "Soldat": "m",       // soldier
  "Sohn": "m",         // son
  "Sonne": "f",        // sun
  "Sprache": "f",      // language
  "Staat": "m",        // state
  "Stadt": "f",        // city
  "Stern": "m",        // star
  "Steuer": "f",       // tax
  "Straße": "f",       // street
  "Student": "m",      // student (male)
  "Studentin": "f",    // student (female)
  "Stuhl": "m",        // chair
  "Stunde": "f",       // hour
  "Suppe": "f",        // soup
  "System": "n",       // system

  // ── T ──────────────────────────────────────────────────────────
  "Tag": "m",          // day
  "Tee": "m",          // tea
  "Tiger": "m",        // tiger
  "Tisch": "m",        // table
  "Tochter": "f",      // daughter
  "Tomate": "f",       // tomato
  "Tod": "m",          // death
  "Treppe": "f",       // stairs
  "Tür": "f",          // door

  // ── U ──────────────────────────────────────────────────────────
  "Unternehmen": "n",  // company
  "Universität": "f",  // university

  // ── V ──────────────────────────────────────────────────────────
  "Vater": "m",        // father
  "Vertrag": "m",      // contract, treaty
  "Vogel": "m",        // bird

  // ── W ──────────────────────────────────────────────────────────
  "Wahl": "f",         // election / choice
  "Wand": "f",         // wall
  "Währung": "f",      // currency
  "Wasser": "n",       // water
  "Wein": "m",         // wine
  "Welt": "f",         // world
  "Wiese": "f",        // meadow
  "Wind": "m",         // wind
  "Wirtschaft": "f",   // economy
  "Woche": "f",        // week
  "Wohnung": "f",      // apartment
  "Wolf": "m",         // wolf

  // ── Z ──────────────────────────────────────────────────────────
  "Zahn": "m",         // tooth
  "Zeit": "f",         // time
  "Zeitung": "f",      // newspaper
  "Zimmer": "n",       // room
  "Zukunft": "f",      // future
  "Zunge": "f",        // tongue
};
