declare module './penal_codes.js' {
    interface PenalCode {
        pc: string;
        offense_class: string;
        title: string;
        description: string;
        fine: number;
        prison_time_months: number;
    }

    const penalCodesData: PenalCode[];
    }

const penalCodesData = [
  {
    "pc": "P.C. 1001",
    "offense_class": "Misdemeanor",
    "title": "Simple Assault",
    "description": "A person who intentionally puts another in the reasonable belief of imminent physical harm or offensive contact is guilty under this code section.",
    "fine": 150,
    "prison_time_months": 1
  },
  {
    "pc": "P.C. 1002",
    "offense_class": "Misdemeanor",
    "title": "Assault",
    "description": "A person who intentionally puts another in the reasonable belief of imminent serious physical harm or offensive contact is guilty under this code section.",
    "fine": 285,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 1003",
    "offense_class": "Felony",
    "title": "Aggravated Assault",
    "description": "A person who uses intentional and unlawful force or violence to cause physical harm to another person is guilty under this code section.",
    "fine": 325,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 1004",
    "offense_class": "Felony",
    "title": "Assault with a Deadly Weapon",
    "description": "A person who attempts to cause or threaten immediate harm to another while using a weapon, tool, or other dangerous item to communicate that threat is guilty under this code section.",
    "fine": 475,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 1005",
    "offense_class": "Misdemeanor",
    "title": "Battery",
    "description": "A person who unlawfully applies force directly or indirectly upon another person or their personal belongings, causing bodily injury or offensive contact is guilty under this code section.",
    "fine": 275,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 1006",
    "offense_class": "Felony",
    "title": "Aggravated Battery",
    "description": "A person who intentionally and unlawfully applies force directly or indirectly upon another person or their personal belongings, causing bodily injury or offensive contact is guilty under this code section.",
    "fine": 375,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 1007",
    "offense_class": "Felony",
    "title": "Involuntary Manslaughter",
    "description": "A person who unintentionally kills another, with or without a quarrel or heat of passion is guilty under this code section. A person who, through a criminal accident or negligence, causes someone's death is guilty under this code section.",
    "fine": 750,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 1008",
    "offense_class": "Felony",
    "title": "Vehicular Manslaughter",
    "description": "A person who, while operating a vehicle, through a criminal accident or negligence, causes someone's death is guilty under this code section.",
    "fine": 750,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 1009",
    "offense_class": "Felony",
    "title": "Attempted Murder of a Civilian",
    "description": "A person who takes a direct step towards killing another person and intended to kill that person is guilty under this code section. A person who is hired to murder, slay, or execute another person for material or financial gain, even if a direct step towards the killing is not taken, is guilty under this code section.",
    "fine": 1500,
    "prison_time_months": 30
  },
  {
    "pc": "P.C. 1010",
    "offense_class": "Felony",
    "title": "Second Degree Murder",
    "description": "A person who unlawfully kills another person either by intentional malice or reckless disregard that occurs in the spur of the moment is guilty under this code section.",
    "fine": 1750,
    "prison_time_months": 40
  },
  {
    "pc": "P.C. 1011",
    "offense_class": "Felony",
    "title": "Accessory to Second Degree Murder",
    "description": "A person who assists another person to commit murder of the second degree is guilty under this code section.",
    "fine": 500,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 1012",
    "offense_class": "Felony",
    "title": "First Degree Murder",
    "description": "A person who commits the intentional killing which is done in a way that is willful, deliberate and premeditated is guilty under this code section. Additionally, a person who kills another individual while engaging in a felony offense, that has been proved to be a premeditated act, is guilty under this code section.",
    "fine": 2500,
    "prison_time_months": 50
  },
  {
    "pc": "P.C. 1013",
    "offense_class": "Felony",
    "title": "Accessory to First Degree Murder",
    "description": "A person who assists another person to commit murder of the first degree is guilty under this code section.",
    "fine": 1500,
    "prison_time_months": 35
  },
  {
    "pc": "P.C. 1014",
    "offense_class": "Felony",
    "title": "Murder of a Public Servant or Peace Officer",
    "description": "A person who commits the intentional killing of a public servant or peace officer, while in the execution of their duties, in a way that is willful, deliberate and premeditated is guilty under this code section.",
    "fine": 8000,
    "prison_time_months": 75
  },
  {
    "pc": "P.C. 1015",
    "offense_class": "Felony",
    "title": "Attempted Murder of a Public Servant or Peace Officer",
    "description": "A person who attempts to unlawfully kill or cause great bodily harm to a public servant or peace officer, while in the execution of their duties, is guilty under this code section.",
    "fine": 3500,
    "prison_time_months": 50
  },
  {
    "pc": "P.C. 1016",
    "offense_class": "Felony",
    "title": "Accessory to the Murder of a Public Servant or Peace Officer",
    "description": "A person who assists another person who attempts to unlawfully kill or cause great bodily harm to a public servant or peace officer, while in the execution of their duties, is guilty under this code section.",
    "fine": 2000,
    "prison_time_months": 35
  },
  {
    "pc": "P.C. 1017",
    "offense_class": "Misdemeanor",
    "title": "Unlawful Imprisonment",
    "description": "A person who intentionally restricts another's freedom of movement without their consent is guilty under this code section.",
    "fine": 300,
    "prison_time_months": 1
  },
  {
    "pc": "P.C. 1018",
    "offense_class": "Felony",
    "title": "Kidnapping",
    "description": "A person who abducts or confines another individual against their will by force, threat, or deception, is guilty under this code section.",
    "fine": 500,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 1019",
    "offense_class": "Misdemeanor",
    "title": "Accessory to Kidnapping",
    "description": "A person who, without directly committing the act of kidnapping, knowingly aids, assists, encourages, or facilitates the commission of the kidnapping by another person is guilty under this code section.",
    "fine": 150,
    "prison_time_months": 7
  },
  {
    "pc": "P.C. 1020",
    "offense_class": "Felony",
    "title": "Attempted Kidnapping",
    "description": "A person who takes a direct step towards the kidnapping of another person is guilty under this code section.",
    "fine": 150,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 1021",
    "offense_class": "Felony",
    "title": "Hostage Taking",
    "description": "A person who kidnaps someone in an attempt to gain the power to attain something, with threat of their life is guilty under this code section.",
    "fine": 750,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 1022",
    "offense_class": "Misdemeanor",
    "title": "Accessory to Hostage Taking",
    "description": "A person who helps someone commit hostage taking is guilty under this code section.",
    "fine": 150,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 1023",
    "offense_class": "Felony",
    "title": "Unlawful Imprisonment of a Public Servant or Peace Officer",
    "description": "A person who intentionally restricts a public servant or peace officer's freedom of movement without their consent is guilty under this code section.",
    "fine": 750,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 1024",
    "offense_class": "Misdemeanor",
    "title": "Criminal Threats",
    "description": "A person who communicates to another that they will physically harm or kill such other, placing such other in a reasonable state of fear for their own safety is guilty under this code section. Such communication can be not just verbal, but also in writing or transmitted through other media.",
    "fine": 200,
    "prison_time_months": 1
  },
  {
    "pc": "P.C. 1025",
    "offense_class": "Misdemeanor",
    "title": "Reckless Endangerment",
    "description": "A person who consciously disregards the potential risks or dangers of their actions which create a substantial serious risk of injury to another person is guilty under this code section.",
    "fine": 175,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 1026",
    "offense_class": "Felony",
    "title": "Gang Related Enhancement",
    "description": "This charge is added to another charge, when the individual’s actions are connected to or motivated by gang activity, which the individual is associated with.",
    "fine": 500,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 1027",
    "offense_class": "Felony",
    "title": "Desecration of a Human Corpse",
    "description": "Any act committed after the death of a human being including, but not limited to, dismemberment, disfigurement, mutilation, burning, or any act committed to cause the dead body to be devoured, scattered or dissipated.",
    "fine": 1000,
    "prison_time_months": 30
  },
  {
    "pc": "P.C. 1028",
    "offense_class": "Felony",
    "title": "Torture",
    "description": "A person who intentionally causes extreme pain and suffering to someone for reasons such as punishment, extracting a confession, interrogation, revenge, extortion, or any sadistic purpose, is guilty under this code section.",
    "fine": 1500,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 2001",
    "offense_class": "Infraction",
    "title": "Petty Theft",
    "description": "A person who steals or takes the personal property of another worth $2000 or less is guilty under this code section.",
    "fine": 400
  },
  {
    "pc": "P.C. 2002",
    "offense_class": "Misdemeanor",
    "title": "Grand Theft",
    "description": "A person who steals or takes the personal property of another worth more than $2,000 but less than $15,000 or a firearm of any value is guilty under this code section.",
    "fine": 850,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 2003",
    "offense_class": "Felony",
    "title": "Grand Theft Auto A",
    "description": "A person who commits the theft of any motor vehicle, no matter the value is guilty under this code section.",
    "fine": 120,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 2004",
    "offense_class": "Felony",
    "title": "Grand Theft Auto B",
    "description": "A person who commits the theft of any motor vehicle, no matter the value, while armed or committing another felony, is guilty under this code section.",
    "fine": 400,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 2005",
    "offense_class": "Felony",
    "title": "Carjacking",
    "description": "A person who commits the theft of a motor vehicle from another person while it is being operated is guilty under this code section.",
    "fine": 400,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 2006",
    "offense_class": "Misdemeanor",
    "title": "Burglary",
    "description": "A person who enters a structure without the permission of the owner or agent of the owner, typically with the intention of committing a criminal offense, is guilty under this code section.",
    "fine": 500,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 2007",
    "offense_class": "Felony",
    "title": "Robbery",
    "description": "A person who takes property from the possession of another against their will, by means of force or fear, such as through criminal threats, blunt weapons, assault or battery is guilty under this code section.",
    "fine": 1000,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 2008",
    "offense_class": "Felony",
    "title": "Accessory to Robbery",
    "description": "A Person who assists someone with committing Robbery is guilty under this code section.",
    "fine": 200,
    "prison_time_months": 12
  },
  {
    "pc": "P.C. 2009",
    "offense_class": "Felony",
    "title": "Attempted Robbery",
    "description": "A person who attempts to take property from the possession of another against their will, by means of force or fear, such as through criminal threats, blunt weapons, assault or battery is guilty under this code section.",
    "fine": 300,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 2010",
    "offense_class": "Felony",
    "title": "Armed Robbery",
    "description": "A person who takes property from the possession of another against their will, by means of force facilitated with a gun or any bladed weapon is guilty under this code section.",
    "fine": 1500,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 2011",
    "offense_class": "Felony",
    "title": "Accessory to Armed Robbery",
    "description": "A person who helps someone to take property from the possession of another against their will, by means of force facilitated with a gun or any bladed weapon is guilty under this code section.",
    "fine": 300,
    "prison_time_months": 12
  },
  {
    "pc": "P.C. 2012",
    "offense_class": "Felony",
    "title": "Attempted Armed Robbery",
    "description": "A person who attempts to take property from the possession of another against their will, by means of force facilitated with a gun or any bladed weapon is guilty under this code section.",
    "fine": 300,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 2013",
    "offense_class": "Felony",
    "title": "Grand Larceny",
    "description": "A person who steals or takes the personal property of another worth more than $15000 is guilty under this code section.",
    "fine": 1000,
    "prison_time_months": 30
  },
  {
    "pc": "P.C. 2014",
    "offense_class": "Infraction",
    "title": "Leaving Without Paying",
    "description": "A person who leaves a billed premises without paying the total amount of their bill is guilty under this code section.",
    "fine": 300
  },
  {
    "pc": "P.C. 2015",
    "offense_class": "Misdemeanor",
    "title": "Possession of Nonlegal Currency",
    "description": "A person who is in possession of, or attempts to use a fraudulent currency in the attempt to pass it off as legal tender is guilty under this code section. The fraudulent currency is subject to confiscation.",
    "fine": 750,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 2016",
    "offense_class": "Misdemeanor",
    "title": "Possession of Government-Issued Items",
    "description": "A person who is unlawfully in possession of a government issued firearm, vehicle, or other item is guilty under this code section.",
    "fine": 1000,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 2017",
    "offense_class": "Misdemeanor",
    "title": "Possession of Items Used in the Commission of a Crime",
    "description": "A person in possession of tools used by that person to commit another crime, such as a firearm or burglary tools, is guilty under this code section.",
    "fine": 500,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 2018",
    "offense_class": "Misdemeanor",
    "title": "Sale of Items Used in the Commission of a Crime",
    "description": "A person who is in possession of, or attempts to use a fraudulent currency in the attempt to pass it off as legal tender is guilty under this code section. The fraudulent currency is subject to confiscation.",
    "fine": 100,
    "prison_time_months": 15
  },
    {
    "pc": "P.C. 2019",
    "offense_class": "Felony",
    "title": "Theft of an Aircraft",
    "description": "A person who commits the theft of an aircraft is guilty under this code section.",
    "fine": 5000,
    "prison_time_months": 40
  },
  {
    "pc": "P.C. 2020",
    "offense_class": "Misdemeanor",
    "title": "Criminal Possession of Stolen Property",
    "description": "A person who has possession of stolen items, with knowledge that the item is stolen, is guilty under this code section.",
    "fine": 200,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 2021",
    "offense_class": "Felony",
    "title": "Theft of a Law Enforcement Vehicle",
    "description": "A person who commits the theft of any motor vehicle owned by a law enforcement agency is guilty under this code section.",
    "fine": 10000,
    "prison_time_months": 60
  },
  {
    "pc": "P.C. 3001",
    "offense_class": "Misdemeanor",
    "title": "Impersonating",
    "description": "A person who attempts to assume the identity of someone else is guilty under this code section.",
    "fine": 1250,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 3002",
    "offense_class": "Felony",
    "title": "Impersonating a Peace Officer or Public Servant",
    "description": "A person who attempts to assume the identity, or state that they are a peace officer or public servant, when they are not, is guilty under this code section.",
    "fine": 2050,
    "prison_time_months": 30
  },
  {
    "pc": "P.C. 3003",
    "offense_class": "Felony",
    "title": "Impersonating a Judge",
    "description": "A person who attempts to assume the identity, or state that they are a judge, when they are not, is guilty under this code section.",
    "fine": 3500,
    "prison_time_months": 45
  },
  {
    "pc": "P.C. 3005",
    "offense_class": "Misdemeanor",
    "title": "Possession of Stolen Government Identification",
    "description": "A person who is in possession of a piece of government identification that does not belong to them, who has not made any attempt to dispose of the item, is guilty under this section.",
    "fine": 200,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 3006",
    "offense_class": "Felony",
    "title": "Extortion",
    "description": "A person who intimidates or influences another to provide or hand over properties or services is guilty under this code section. A person who utilizes or threatens their power or authority with demonstrated malice aforethought in order to compel action by another is guilty under this code section.",
    "fine": 1500,
    "prison_time_months": 30
  },
  {
    "pc": "P.C. 3007",
    "offense_class": "Misdemeanor",
    "title": "Fraud",
    "description": "A person who knowingly alters, creates, or uses a written document with the intent to defraud or deceive another is guilty under this code section.",
    "fine": 150,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 3008",
    "offense_class": "Misdemeanor",
    "title": "Forgery",
    "description": "A person who knowingly signs a document or agreement, electronic or otherwise, without the consent or authority of whom they are signing for is guilty under this code section. A person who creates fake government documents is guilty under this code section.",
    "fine": 650,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 3009",
    "offense_class": "Felony",
    "title": "Money Laundering",
    "description": "A person who possesses, hides, transfers, receives, or maintains the storage of funds earned through comprehensive criminal activities is guilty under this code. A person who maintains an establishment with a purpose to launder funds collected through comprehensive criminal activities is guilty under this code section.",
    "fine": 4000,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 4001",
    "offense_class": "Misdemeanor",
    "title": "Trespassing",
    "description": "A person who remains on a property after being told to leave by the property owner, an agent of the property owner, or a peace officer, or returns to a property after having been previously trespassed from the property is guilty under this code section.",
    "fine": 455,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 4002",
    "offense_class": "Felony",
    "title": "Felony Trespassing",
    "description": "A person who, without proper authorization, enters any government-owned or managed facility that is secured with the intent of keeping ordinary citizens outside is guilty under this code section.",
    "fine": 1500,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 4003",
    "offense_class": "Felony",
    "title": "Arson",
    "description": "A person who intentionally and maliciously sets fire to or burns any structure, forest land, or property without prior authorization is guilty under this code section. A person who intentionally aids, counsels, or helps facilitate the burning of any structure, forest land, or property without proper authorization is guilty under this code section.",
    "fine": 2500,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 4004",
    "offense_class": "Infraction",
    "title": "Vandalism",
    "description": "A person that defaces, damages, or destroys property which belongs to another is guilty under this code section.",
    "fine": 100
  },
  {
    "pc": "P.C. 4005",
    "offense_class": "Misdemeanor",
    "title": "Vandalism of Government Property",
    "description": "A person that defaces, damages, or destroys property which belongs to a government agency is guilty under this code section.",
    "fine": 350,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 4006",
    "offense_class": "Infraction",
    "title": "Littering",
    "description": "As used in this section, \"litter\" means garbage, trash, waste, ashes, cans, bottles, wire, paper, cartons, vessel parts, vehicle parts, furniture, glass, or anything else of an unsightly or unsanitary nature. No person shall place any waste, refuse, litter or foreign substance in any area or receptacle except those provided for that purpose.",
    "fine": 150
},
{
  "pc": "P.C. 5001",
    "offense_class": "Felony",
    "title": "Bribery of a Government Official",
    "description": "A person who offers or gives a monetary gift, gratuity, valuable goods, or other reward to a public official, a government employee, or peace officer in an attempt to influence their duties or actions is guilty under this code section.",
    "fine": 200,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 5002",
    "offense_class": "Infraction",
    "title": "Anti-Mask Law",
    "description": "A person who wears a mask or face covering while committing a crime is guilty under this code section. A person who wears a mask in a government facility, after being asked to remove it, is guilty under this code section.",
    "fine": 150
  },
  {
    "pc": "P.C. 5003",
    "offense_class": "Felony",
    "title": "Possession of Contraband in a Government Facility",
    "description": "A person who possesses a controlled substance, illegal firearm, or any other illegal item while on the premises of a government facility is guilty under this code section.",
    "fine": 200,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 5004",
    "offense_class": "Felony",
    "title": "Escaping",
    "description": "Any person arrested, detained, booked, charged, or convicted of any crime who thereafter escapes from a county or city jail, prison, community service, or custody of a Correctional or Parole Officer, Peace Officer, Police Officer, or Federal Agent is guilty under this code section.",
    "fine": 1005,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 5005",
    "offense_class": "Felony",
    "title": "Jailbreak",
    "description": "A person who breaks out a prisoner from a correctional facility without authorization is guilty under this code section.",
    "fine": 2500,
    "prison_time_months": 30
  },
  {
    "pc": "P.C. 5006",
    "offense_class": "Felony",
    "title": "Accessory to Jailbreak",
    "description": "A person who helps someone to break out a prisoner from a correctional facility without authorization is guilty under this code section.",
    "fine": 500,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 5007",
    "offense_class": "Felony",
    "title": "Attempted Jailbreak",
    "description": "A person who attempts to break out a prisoner from a correctional facility without authorization is guilty under this code section.",
    "fine": 1000,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 5008",
    "offense_class": "Felony",
    "title": "Perjury",
    "description": "A person who willfully gives false information while testifying in court, during a deposition, or on a signed document presented to a court is guilty under this section.",
    "fine": 4000,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 5009",
    "offense_class": "Misdemeanor",
    "title": "Violation of a Restraining Order",
    "description": "A person who knowingly and intentionally violates the parameters of a restraining order against them is guilty under this code section.",
    "fine": 525,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 5010",
    "offense_class": "Misdemeanor",
    "title": "Embezzlement",
    "description": "A person who steals or misappropriates funds in their trust or belonging to their employer is guilty under this code section.",
    "fine": 1000,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 5011",
    "offense_class": "Misdemeanor",
    "title": "Unlawful Practice",
    "description": "A person who practices medical procedures that they are not licensed or lawfully allowed to practice is guilty under this code section.",
    "fine": 1500,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 5012",
    "offense_class": "Infraction",
    "title": "Misuse of Emergency Systems",
    "description": "A person who misuses an emergency system, such as 911 or panic buttons, to waste police time or resources, is guilty under this code section.",
    "fine": 600
  },
  {
    "pc": "P.C. 5013",
    "offense_class": "Misdemeanor",
    "title": "Conspiracy",
    "description": "A person who conspires to commit a crime, either alone or with a group, is guilty under this section. A person charged with this can be charged up to half of the fine and sentence of the conspired crime.",
    "fine": 0
  },
  {
    "pc": "P.C. 5014",
    "offense_class": "Misdemeanor",
    "title": "Violating a Court Order",
    "description": "A person who fails to abide by a court order ruled by a judge of San Andreas is guilty under this code section.",
    "fine": 800,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 5015",
    "offense_class": "Misdemeanor",
    "title": "Failure to Appear",
    "description": "A person who fails to appear to a lawfully binding court summons or order for appearance is guilty under this code section.",
    "fine": 650,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 5016",
    "offense_class": "Misdemeanor",
    "title": "Contempt of Court",
    "description": "A person who is disrespectful of the court process, such as being excessively loud or belligerent, refusing to be sworn in as a witness, refusing to comply with a judge's request, is guilty under this code section. Repeated offenses can result in multiplication of the maximum fine and sentence.",
    "fine": 300,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 5017",
    "offense_class": "Misdemeanor",
    "title": "Resisting Arrest",
    "description": "A person who avoids apprehension from an officer by non-vehicular means or resists apprehension by any physical means is guilty under this code section.",
    "fine": 750,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 6001",
    "offense_class": "Infraction",
    "title": "Disobeying a Peace Officer",
    "description": "A person who fails to comply with a lawful order given from an on-duty peace officer or public servant is guilty under this code section.",
    "fine": 175
  },
  {
    "pc": "P.C. 6002",
    "offense_class": "Infraction",
    "title": "Disorderly Conduct",
    "description": "A person who engages in conduct that corrupts the public morals, outrages public decency, breaches the peace, or brawls is guilty under this code section.",
    "fine": 125
  },
  {
    "pc": "P.C. 6003",
    "offense_class": "Infraction",
    "title": "Disturbing the Peace",
    "description": "A person who violates a reasonable expectation of peace in a public area is guilty under this code section.",
    "fine": 100
  },
  {
    "pc": "P.C. 6004",
    "offense_class": "Misdemeanor",
    "title": "False Reporting",
    "description": "A person who reports to any peace officer that a felony or misdemeanor has been committed knowing the report to be false is guilty under this code section.",
    "fine": 175,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 6005",
    "offense_class": "Misdemeanor",
    "title": "Harassment",
    "description": "A person who makes repeated communications intended to cause annoyance, via internet, phone, or other devices, is guilty under this code section.",
    "fine": 250,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 6006",
    "offense_class": "Misdemeanor",
    "title": "Misdemeanor Obstruction of Justice",
    "description": "A person who attempts to prevent a peace officer from conducting their duties or completing an investigation is guilty under this code section.",
    "fine": 500,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 6007",
    "offense_class": "Felony",
    "title": "Felony Obstruction of Justice",
    "description": "A person who attempts to prevent an official government proceeding or government officer from completing their duties is guilty under this code section.",
    "fine": 900,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 6008",
    "offense_class": "Felony",
    "title": "Inciting a Riot",
    "description": "A person who urges others to commit force, violence, or property destruction, under circumstances producing a clear and immediate danger, is guilty under this code section.",
    "fine": 500,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 6009",
    "offense_class": "Infraction",
    "title": "Loitering on Government Properties",
    "description": "Criminal loitering refers to lingering in an area with intent to commit criminal activity or to aid another in doing so.",
    "fine": 100
  },
  {
    "pc": "P.C. 6010",
    "offense_class": "Misdemeanor",
    "title": "Vehicle Tampering",
    "description": "A person who intentionally tampers with or damages a vehicle without the consent of the owner is guilty under this code section.",
    "fine": 175,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 6011",
    "offense_class": "Felony",
    "title": "Evidence Tampering",
    "description": "A person who willfully destroys, conceals, or alters evidence that can be used in a criminal investigation or court proceeding is guilty under this code section.",
    "fine": 150,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 6012",
    "offense_class": "Felony",
    "title": "Witness Tampering",
    "description": "A person who knowingly uses bribery, fear, or other tactics to prevent or encourage a witness or victim from giving testimony is guilty under this code section.",
    "fine": 1000,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 6013",
    "offense_class": "Misdemeanor",
    "title": "Failure to Provide Identification",
    "description": "A person who fails to identify themselves when lawfully ordered to do so by a law enforcement officer is guilty under this code section.",
    "fine": 350,
    "prison_time_months": 1
  },
  {
    "pc": "P.C. 6014",
    "offense_class": "Felony",
    "title": "Vigilantism",
    "description": "A person who unlawfully attempts to enforce law or act as law enforcement is guilty under this code section.",
    "fine": 150,
    "prison_time_months": 30
  },
  {
    "pc": "P.C. 6015",
    "offense_class": "Misdemeanor",
    "title": "Unlawful Assembly",
    "description": "When two or more persons assemble to commit an unlawful act or engage in violent or tumultuous conduct, they are guilty under this code section.",
    "fine": 750,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 6016",
    "offense_class": "Felony",
    "title": "Government Corruption",
    "description": "A government employee who acts against the public interest, demonstrates criminal negligence, or commits a felony while on duty is guilty under this code section.",
    "fine": 2000,
    "prison_time_months": 40
  },
  {
    "pc": "P.C. 6017",
    "offense_class": "Felony",
    "title": "Stalking",
    "description": "A person who intentionally and maliciously follows or harasses another, causing them to fear for their safety, is guilty under this code section.",
    "fine": 350,
    "prison_time_months": 30
  },
  {
    "pc": "P.C. 6018",
    "offense_class": "Misdemeanor",
    "title": "Aiding and Abetting",
    "description": "A person who assists in committing a crime or helps a wanted person evade arrest is guilty under this code section.",
    "fine": 140,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 6019",
    "offense_class": "Misdemeanor",
    "title": "Harboring a Fugitive",
    "description": "A person who knowingly hides or prevents law enforcement from finding a wanted felon is guilty under this code section.",
    "fine": 375,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 7001",
    "offense_class": "Misdemeanor",
    "title": "Illegal Cultivation of Marijuana",
    "description": "Cultivating more than 6 marijuana plants or cultivating on public property is prohibited. Plants can be seized or destroyed under warrant.",
    "fine": 2500,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 7002",
    "offense_class": "Felony",
    "title": "Illegal Cultivation of Marijuana",
    "description": "Cultivation over 6 plants after prior convictions or involving environmental violations is a felony.",
    "fine": 5000,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 7003",
    "offense_class": "Misdemeanor",
    "title": "Possession of Marijuana",
    "description": "Possessing more than 10 kg but less than 100 kg of illegal marijuana is guilty under this code section.",
    "fine": 200,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 7004",
    "offense_class": "Felony",
    "title": "Possession of Marijuana with Intent to Distribute",
    "description": "Possessing over 100 kg of marijuana or more than 30 kg packaged for sale, with distribution items, is guilty under this code section.",
    "fine": 500,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 7005",
    "offense_class": "Misdemeanor",
    "title": "Misdemeanor Possession of Cocaine",
    "description": "Possessing under 10 kg of powder or crack cocaine is guilty under this code section.",
    "fine": 500
  },
  {
    "pc": "P.C. 7006",
    "offense_class": "Felony",
    "title": "Felony Possession of Cocaine",
    "description": "Possessing more than 10 kg but less than 100 kg of powder or crack cocaine is guilty under this code section.",
    "fine": 750,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 7007",
    "offense_class": "Felony",
    "title": "Possession of Cocaine with Intent to Distribute",
    "description": "Possessing over 100 kg of cocaine, packaged for sale with distribution items, is guilty under this code section.",
    "fine": 1300,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 7008",
    "offense_class": "Misdemeanor",
    "title": "Misdemeanor Possession of Amphetamines",
    "description": "Possessing under 10 kg of amphetamines (e.g., meth, Adderall) is guilty under this code section.",
    "fine": 300
  },
  {
    "pc": "P.C. 7009",
    "offense_class": "Felony",
    "title": "Felony Possession of Amphetamines",
    "description": "Possessing more than 10 kg but less than 100 kg of amphetamines is guilty under this code section.",
    "fine": 750,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 7010",
    "offense_class": "Felony",
    "title": "Possession of Amphetamines with Intent to Distribute",
    "description": "Possessing over 100 kg of amphetamines packaged for sale with distribution items is guilty under this code section.",
    "fine": 1500,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 7011",
    "offense_class": "Misdemeanor",
    "title": "Misdemeanor Possession of Opioids",
    "description": "Possessing under 10 kg of opioids (e.g., morphine, heroin) is guilty under this code section.",
    "fine": 350
  },
  {
    "pc": "P.C. 7012",
    "offense_class": "Felony",
    "title": "Felony Possession of Opioids",
    "description": "Possessing more than 10 kg but less than 100 kg of opioids is guilty under this code section.",
    "fine": 450,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 7013",
    "offense_class": "Felony",
    "title": "Possession of Opioids with Intent to Distribute",
    "description": "Possessing over 50 kg of opioids packaged for sale is guilty under this code section.",
    "fine": 1450,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 7014",
    "offense_class": "Misdemeanor",
    "title": "Possession of Drug Paraphernalia",
    "description": "Possessing equipment intended for use in injecting, ingesting, inhaling, or introducing a controlled substance is guilty under this code section.",
    "fine": 350,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 7015",
    "offense_class": "Felony",
    "title": "Possession of Drug Manufacturing Materials",
    "description": "Possessing equipment that could be used to manufacture or process controlled substances is guilty under this code section.",
    "fine": 750,
    "prison_time_months": 7
  },
  {
    "pc": "P.C. 7016",
    "offense_class": "Misdemeanor",
    "title": "Sale of a Controlled Substance",
    "description": "Selling, offering to sell, transporting with intent to sell, or giving away a controlled substance is guilty under this code section.",
    "fine": 800,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 7017",
    "offense_class": "Felony",
    "title": "Drug Trafficking",
    "description": "Transporting over 250 kg of a controlled substance across state lines with intent to distribute is guilty under this code section.",
    "fine": 5000,
    "prison_time_months": 60
  },
  {
    "pc": "P.C. 7018",
    "offense_class": "Felony",
    "title": "Driving Under the Influence of Narcotics",
    "description": "Operating a vehicle under the influence of narcotics or impairing medication is guilty under this code section.",
    "fine": 300,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 7019",
    "offense_class": "Infraction",
    "title": "Public Intoxication",
    "description": "Being under the influence of alcohol in a public place and disturbing peace is guilty under this code section.",
    "fine": 150
  },
  {
    "pc": "P.C. 7019",
    "offense_class": "Infraction",
    "title": "Public Indecency",
    "description": "Failing to dress appropriately in public or displaying oneself to unconsenting parties is guilty under this code section.",
    "fine": 200
  },
  {
    "pc": "P.C. 8001",
    "offense_class": "Felony",
    "title": "Criminal Possession of Weapon Class A",
    "description": "Illegally possessing a Class A weapon (e.g., switchblade, brass knuckles) is guilty under this code section.",
    "fine": 250,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 8002",
    "offense_class": "Felony",
    "title": "Criminal Possession of Weapon Class B",
    "description": "Illegally possessing a Class B weapon (semi-automatic handgun or rifle) is guilty under this code section.",
    "fine": 2000,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 8003",
    "offense_class": "Felony",
    "title": "Criminal Possession of Weapon Class C",
    "description": "Illegally possessing a Class C weapon (automatic handgun or rifle) is guilty under this code section.",
    "fine": 5000,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 8004",
    "offense_class": "Felony",
    "title": "Criminal Possession of Weapon Class D",
    "description": "Illegally possessing a Class D weapon (heavy artillery, explosives) is guilty under this code section.",
    "fine": 7500,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 8005",
    "offense_class": "Felony",
    "title": "Criminal Sale of Weapon Class A",
    "description": "Illegally selling or distributing a Class A weapon is guilty under this code section.",
    "fine": 450,
    "prison_time_months": 25
  },
  {
    "pc": "P.C. 8006",
    "offense_class": "Felony",
    "title": "Criminal Sale of Weapon Class B",
    "description": "Illegally selling or distributing a Class B weapon is guilty under this code section.",
    "fine": 5000,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 8007",
    "offense_class": "Felony",
    "title": "Criminal Sale of Weapon Class C",
    "description": "Illegally selling or distributing a Class C weapon is guilty under this code section.",
    "fine": 9000,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 8008",
    "offense_class": "Felony",
    "title": "Criminal Sale of Weapon Class D",
    "description": "Illegally selling or distributing a Class D weapon is guilty under this code section.",
    "fine": 12000,
    "prison_time_months": 60
  },
  {
    "pc": "P.C. 8009",
    "offense_class": "Misdemeanor",
    "title": "Criminal Use of Weapon",
    "description": "Using a weapon or firearm in the commission of a crime is guilty under this code section.",
    "fine": 4000,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 8010",
    "offense_class": "Misdemeanor",
    "title": "Possession of Illegal Firearm Modifications",
    "description": "Possessing illegal firearm modifications (full auto switch, suppressor, serial number removal, etc.) is guilty under this code section.",
    "fine": 4000,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 8011",
    "offense_class": "Felony",
    "title": "Weapon Trafficking",
    "description": "Transporting more than eight illegal firearms with intent to distribute is guilty under this code section.",
    "fine": 11000,
    "prison_time_months": 45
  },
  {
    "pc": "P.C. 8012",
    "offense_class": "Felony",
    "title": "Illegal Manufacturing of Firearms",
    "description": "Manufacturing firearms without eligibility or registration is guilty under this code section.",
    "fine": 5000,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 8013",
    "offense_class": "Misdemeanor",
    "title": "Possession of Firearms Without Serial Numbers",
    "description": "Possessing a firearm without a registered serial number is guilty under this code section.",
    "fine": 2500,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 8014",
    "offense_class": "Misdemeanor",
    "title": "Brandishing a Weapon",
    "description": "Removing a firearm from concealment or holster in public without threat is guilty under this code section.",
    "fine": 2500,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 8015",
    "offense_class": "Felony",
    "title": "Insurrection",
    "description": "Inciting, assisting, or engaging in rebellion against U.S. authority is guilty under this code section.",
    "fine": 20000,
    "prison_time_months": 240
  },
  {
    "pc": "P.C. 8015",
    "offense_class": "Felony",
    "title": "Flying into Restricted Airspace",
    "description": "Operating an aircraft into restricted or controlled airspace without authorization is guilty under this code section.",
    "fine": 750,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 8017",
    "offense_class": "Infraction",
    "title": "Jaywalking",
    "description": "Crossing a road outside a valid crossing within 100 meters of one is guilty under this code section.",
    "fine": 100
  },
  {
    "pc": "P.C. 8018",
    "offense_class": "Felony",
    "title": "Criminal Use of Explosives",
    "description": "Using explosives or incendiaries in the commission of a crime is guilty under this code section.",
    "fine": 5000,
    "prison_time_months": 30
  },
  {
    "pc": "P.C. 9001",
    "offense_class": "Misdemeanor",
    "title": "Driving While Intoxicated",
    "description": "Operating a motor vehicle with a BAC over 0.08 is guilty under this code section.",
    "fine": 100,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 9002",
    "offense_class": "Misdemeanor",
    "title": "Evading",
    "description": "Willfully fleeing or eluding a pursuing peace officer is guilty under this code section.",
    "fine": 200,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 9003",
    "offense_class": "Felony",
    "title": "Reckless Evading",
    "description": "Evading a peace officer in a reckless or dangerous manner is guilty under this code section.",
    "fine": 750,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 9004",
    "offense_class": "Infraction",
    "title": "Failure to Yield to Emergency Vehicle",
    "description": "Failing to yield to emergency lights and sirens is guilty under this code section.",
    "fine": 120
  },
  {
    "pc": "P.C. 9005",
    "offense_class": "Infraction",
    "title": "Failure to Obey Traffic Control Device",
    "description": "Ignoring stop signs, traffic lights, or yield signs is guilty under this code section.",
    "fine": 150
  },
  {
    "pc": "P.C. 9006",
    "offense_class": "Infraction",
    "title": "Unroadworthy Vehicle",
    "description": "Operating a vehicle not permitted for public roads is guilty under this code section.",
    "fine": 450
  },
  {
    "pc": "P.C. 9007",
    "offense_class": "Infraction",
    "title": "Negligent Driving",
    "description": "Driving that endangers others due to negligence is guilty under this code section.",
    "fine": 125
  },
  {
    "pc": "P.C. 9008",
    "offense_class": "Misdemeanor",
    "title": "Reckless Driving",
    "description": "Driving that endangers others due to recklessness is guilty under this code section.",
    "fine": 725,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 9009",
    "offense_class": "Infraction",
    "title": "Speeding 1–10",
    "description": "Driving up to 10 mph over the posted speed limit is guilty under this code section.",
    "fine": 100
  },
  {
    "pc": "P.C. 9010",
    "offense_class": "Infraction",
    "title": "Speeding 11–25",
    "description": "Driving 11–25 mph over the posted speed limit is guilty under this code section.",
    "fine": 500
  },
  {
    "pc": "P.C. 9011",
    "offense_class": "Infraction",
    "title": "Speeding 26–39",
    "description": "Driving 26–39 mph over the posted speed limit is guilty under this code section.",
    "fine": 700
  },
  {
    "pc": "P.C. 9012",
    "offense_class": "Misdemeanor",
    "title": "Reckless Speeding (40+)",
    "description": "Driving more than 40 mph over the posted speed limit is a misdemeanor under this code section. No jail penalty applies.",
    "fine": 1100
  },
  {
    "pc": "P.C. 9013",
    "offense_class": "Infraction",
    "title": "Unlicensed Operation of Vehicle",
    "description": "Operating a vehicle without the proper license is guilty under this code section.",
    "fine": 350
  },
  {
    "pc": "P.C. 9014",
    "offense_class": "Infraction",
    "title": "Failing to Present a Driver's License",
    "description": "Failing to display a valid driver’s license upon request is guilty under this code section.",
    "fine": 200
  },
  {
    "pc": "P.C. 9015",
    "offense_class": "Infraction",
    "title": "Illegal U-Turn",
    "description": "Making a U-turn where not permitted is guilty under this code section.",
    "fine": 100
  },
  {
    "pc": "P.C. 9016",
    "offense_class": "Infraction",
    "title": "Illegal Passing",
    "description": "Passing unsafely or where markings disallow it is guilty under this code section.",
    "fine": 100
  },
  {
    "pc": "P.C. 9017",
    "offense_class": "Infraction",
    "title": "Failure to Maintain Lane",
    "description": "Crossing lane markings incorrectly is guilty under this code section.",
    "fine": 100
  },
  {
    "pc": "P.C. 9018",
    "offense_class": "Infraction",
    "title": "Illegal Turn",
    "description": "Making a turn from the wrong lane or where disallowed is guilty under this code section.",
    "fine": 100
  },
  {
    "pc": "P.C. 9019",
    "offense_class": "Infraction",
    "title": "Unauthorized Parking",
    "description": "Parking illegally in no-parking zones is guilty under this code section.",
    "fine": 100
  },
  {
    "pc": "P.C. 9020",
    "offense_class": "Misdemeanor",
    "title": "Hit and Run",
    "description": "Failing to stop and exchange information after an accident is guilty under this code section.",
    "fine": 500,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 9021",
    "offense_class": "Infraction",
    "title": "Driving without Headlights or Signals",
    "description": "Operating without required lights or signals is guilty under this code section.",
    "fine": 100
  },
  {
    "pc": "P.C. 9022",
    "offense_class": "Misdemeanor",
    "title": "Motor Vehicle Contest",
    "description": "Engaging in racing or contests on public roads is guilty under this code section.",
    "fine": 1000,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 9023",
    "offense_class": "Felony",
    "title": "Piloting without Proper Licensing",
    "description": "Operating an aircraft without proper licenses is guilty under this code section.",
    "fine": 1500,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 9024",
    "offense_class": "Infraction",
    "title": "Illegal Vehicle Modifications",
    "description": "Using vehicle upgrades illegal for street use is guilty under this code section.",
    "fine": 650
  },
  {
    "pc": "P.C. 9025",
    "offense_class": "Infraction",
    "title": "Public Disturbance by Motor Vehicle",
    "description": "Using a vehicle to cause disturbances (burnouts, loud music) is guilty under this code section.",
    "fine": 350
  },
  {
    "pc": "P.C. 10001",
    "offense_class": "Infraction",
    "title": "Hunting in Restricted Areas",
    "description": "Hunting outside allocated areas is guilty under this code section.",
    "fine": 450
  },
  {
    "pc": "P.C. 10002",
    "offense_class": "Infraction",
    "title": "Unlicensed Hunting",
    "description": "Hunting without the appropriate license is guilty under this code section.",
    "fine": 450
  },
  {
    "pc": "P.C. 10003",
    "offense_class": "Misdemeanor",
    "title": "Animal Cruelty",
    "description": "Maliciously harming an animal without cause is guilty under this code section.",
    "fine": 450,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 10004",
    "offense_class": "Misdemeanor",
    "title": "Hunting with a Non-Hunting Weapon",
    "description": "Hunting with an unlicensed weapon is guilty under this code section.",
    "fine": 450,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 10005",
    "offense_class": "Infraction",
    "title": "Hunting outside of Hunting Hours",
    "description": "Hunting outside legal hours (dawn to dusk) is guilty under this code section.",
    "fine": 450
  },
  {
    "pc": "P.C. 10006",
    "offense_class": "Misdemeanor",
    "title": "Overhunting",
    "description": "Exceeding the 200 kg daily meat/skin limit is guilty under this code section.",
    "fine": 110,
    "prison_time_months": 10
  },
  {
    "pc": "P.C. 10007",
    "offense_class": "Felony",
    "title": "Animal Poaching",
    "description": "Hunting endangered or protected species is guilty under this code section.",
    "fine": 1250,
    "prison_time_months": 20
  },
  {
    "pc": "P.C. 10008",
    "offense_class": "Misdemeanor",
    "title": "Fishing in an Unauthorized Zone",
    "description": "Fishing in prohibited waterways is guilty under this code section.",
    "fine": 3275,
    "prison_time_months": 5
  },
  {
    "pc": "P.C. 10009",
    "offense_class": "Misdemeanor",
    "title": "Illegal Fishing",
    "description": "Using illegal equipment or possessing prohibited species is guilty under this code section.",
    "fine": 6250,
    "prison_time_months": 15
  },
  {
    "pc": "P.C. 10010",
    "offense_class": "Infraction",
    "title": "Overfishing",
    "description": "Exceeding the daily catch limit is punishable by per-fish fines and inspections.",
    "fine": 600
  }
];

export default penalCodesData;

