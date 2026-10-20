# Website claims → sources

Audit of every factual or scientific claim on the marketing site (`apps/web/components/sections/*`), October 2026.

- ✅ **Backed**: the source exists and says this.
- ⚠️ **Fix wording**: a real source exists, but the site's number, attribution, or framing is off.
- ❌ **No source**: no peer-reviewed source found. Remove it, or swap it for the replacement given.

Books are cited as books. Where a book's claim rests on a study, the study is listed, because the study is what a skeptical reader will look for.

---

## 1. Problem page (`ProblemSection.tsx`)

| Claim on site | Verdict | Source / fix |
|---|---|---|
| **80%** abandon or fall short of health goals within 3 months | ⚠️ | The "80%" figure traces to pop-press stats on New Year's resolutions, not to a study. The closest peer-reviewed number: **Sperandei, Vieira & Reis (2016)**, *Adherence to physical activity in an unsupervised setting: Explanatory variables for high attrition rates among fitness center members*, J Sci Med Sport 19(11):916–920. Of 5,240 gym members, **63% quit before month 3** and **under 4% lasted 12 months**. Suggested rewrite: "63% of new gym members quit within 3 months." Also relevant: Norcross, Mrykalo & Blagys (2002), J Clin Psychol 58(4):397–405, where 46% of resolvers were still succeeding at 6 months. |
| 100-person grid: 20 stay, 80 drop | ⚠️ | If you switch to Sperandei, show 37 staying at day 90 (and about 4 at a year). |
| **5+** apps the average person manages for their health | ❌ | No study found. Remove it, or relabel it as your own survey result once the survey has enough responses. |
| **4×** restarts per year | ❌ | No study found, in this text or the "Repeats 4× per year on average" caption. Same fix as above. |

## 2. Research page (`ResearchSection.tsx`)

### Stats bar

| Claim | Verdict | Fix |
|---|---|---|
| 12+ peer-reviewed studies referenced | ⚠️ | The library has 12 entries, but only **4 are peer-reviewed papers**. The other 7 are books and 1 is a cohort study. Say "12 sources", or add the papers below and count those. |
| 3 PhD advisors · 4 institutions · 40+ years combined expertise | ❌ unless true | No source can back these. They are claims about Kinextion itself. If you don't have named advisors who agreed to be listed, remove them now. This is the riskiest copy on the site. |
| "Every feature is grounded in peer-reviewed research" | ⚠️ | Overstated while most entries are books. Softer: "grounded in published research." |

### Atomic Habits (Clear, 2018): book
| Claim | Verdict | Source / fix |
|---|---|---|
| Two quotes | ✅ | The book. |
| Habits anchored to routines show **3× 90-day retention** | ❌ | Not in the book. The real study behind the idea: **Milne, Orbell & Sheeran (2002)**, *Combining motivational and volitional interventions to promote exercise participation*, Br J Health Psychol 7(2):163–184. **91%** of people who wrote down when and where they'd exercise did it, vs **35–38%** of controls. Meta-analysis: **Gollwitzer & Sheeran (2006)**, Adv Exp Soc Psychol 38:69–119, d = 0.65. |
| 1% daily → 37× in a year | ✅ | Arithmetic: 1.01³⁶⁵ ≈ 37.8. It's an illustration, not a finding. |
| *Worth adding* | | **Lally et al. (2010)**, *How are habits formed*, Eur J Soc Psychol 40(6):998–1009. A habit took a median **66 days** to form (range 18–254). |

### Why We Sleep (Walker, 2017): book
Some of the book's claims have been publicly disputed (Guzey, 2019). Cite the underlying papers instead.
| Claim | Verdict | Source / fix |
|---|---|---|
| 17–19 h awake = legally drunk | ⚠️ | **Williamson & Feyer (2000)**, Occup Environ Med 57(10):649–655: 17–19 h awake ≈ **0.05% BAC**. **Dawson & Reid (1997)**, Nature 388:235: 24 h ≈ 0.10%. 0.05% is below the US legal limit (0.08%), so say "equivalent to a 0.05% blood-alcohol level." |
| Shorter sleep, shorter life | ⚠️ | **Cappuccio et al. (2010)**, Sleep 33(5):585–592, meta-analysis: short sleep → **12% higher mortality**. The site's cancer and Alzheimer's add-ons have weaker evidence. |
| <6 h sleep → 4× more likely to catch a cold | ✅ | **Prather et al. (2015)**, *Behaviorally assessed sleep and susceptibility to the common cold*, Sleep 38(9):1353–1359. Odds were **4.2×**. |
| NREM consolidates motor memory, REM processes emotional memory | ✅ (simplified) | **Walker & Stickgold (2004)**, Neuron 44(1):121–133. **Walker & van der Helm (2009)**, Psychol Bull 135(5):731–748. Drop "only in sleep", which overstates it. |

### Harvard Study of Adult Development: cohort study
| Claim | Verdict | Source / fix |
|---|---|---|
| 85 years, 724 men | ✅ | **Waldinger & Schulz (2023)**, *The Good Life* (Simon & Schuster). 268 Harvard men plus 456 Boston men = 724. |
| Most satisfied in relationships at 50 = healthiest at 80 | ✅ | Waldinger & Schulz (2023). **Vaillant & Mukamal (2001)**, *Successful aging*, Am J Psychiatry 158(6):839–847. |
| Loneliness was the strongest predictor of cognitive decline, ahead of cholesterol | ⚠️ | Waldinger's actual claim: relationship satisfaction at 50 predicted health at 80 better than cholesterol did. On memory: **Waldinger et al. (2015)**, *Security of attachment to spouses in late life*, Clin Psychol Sci 3(4):516–529. Reword to match. |
| Midlife isolation as harmful as 15 cigarettes a day | ❌ misattributed | Not from the Harvard study. It's a comparison Holt-Lunstad drew from her 2010 meta-analysis (see below). Remove it from this card. |
| Publisher: "JAMA Psychiatry" | ⚠️ | Wrong. Use "Harvard Medical School / Massachusetts General Hospital." |

### Christakis & Fowler (2007): NEJM 357(4):370–379
| Claim | Verdict | Fix |
|---|---|---|
| Close friend becomes obese → your risk +57% | ✅ | The paper. |
| Spreads up to 3 degrees | ✅ | **Christakis & Fowler (2009)**, *Connected* (book). Shown for happiness in **Fowler & Christakis (2008)**, BMJ 337:a2338. |
| Exercise, eating, smoking cessation, happiness all spread | ⚠️ | Smoking: **Christakis & Fowler (2008)**, NEJM 358:2249–2258. Happiness: BMJ 2008, above. Exercise isn't in their papers. Use **Aral & Nicolaides (2017)**, *Exercise contagion in a global social network*, Nat Commun 8:14753. |
| Strongest when behaviour is mutually visible | ⚠️ | The paper says **mutual friendship**, not visibility: risk rose **171%** when both people named each other as friends. Reword. |
| Caveat | | The causal reading is debated: **Cohen-Cole & Fletcher (2008)**, BMJ 337:a2533. Fine to cite. Don't call it "proven." |

### Outlive (Attia, 2023): book
| Claim | Verdict | Source / fix |
|---|---|---|
| Lowest VO₂max quintile = 5× mortality of highest | ⚠️ | **Mandsager et al. (2018)**, *Association of cardiorespiratory fitness with long-term mortality*, JAMA Netw Open 1(6):e183605. Lowest-fitness vs **elite** (top 2.3%) hazard ratio = **5.04**. These aren't quintiles. Say "least fit vs elite." |
| Stronger predictor than smoking or blood pressure | ✅ | Same paper. Poor fitness carried risk comparable to or greater than smoking, diabetes and coronary disease. |
| Zone 2 builds mitochondrial density | ⚠️ | Mostly mechanistic and expert opinion: **San-Millán & Brooks (2018)**, Sports Med 48:467–479. Soften to "is associated with." |
| Muscle mass predicts later-life outcomes | ✅ | **Srikanthan & Karlamangla (2014)**, Am J Med 127(6):547–553 (muscle mass and mortality). "Build it in your 30s or you don't" is rhetoric. Soften it. |

### Holt-Lunstad et al. (2015): Perspect Psychol Sci 10(2):227–237
| Claim | Verdict | Fix |
|---|---|---|
| Isolation +26% mortality | ⚠️ | 26% is **loneliness**. Isolation was **29%** and living alone **32%**. |
| 3.4 million people, **148 studies** | ⚠️ mixed up | 2015 = **70 studies, 3.4 million**. The 148 studies figure comes from **Holt-Lunstad, Smith & Layton (2010)**, PLoS Med 7(7):e1000316 (308,849 people, **50%** better survival with strong social ties). Pick one paper. |
| = 15 cigarettes a day | ⚠️ | This comes from the **2010** paper's comparison, not the 2015 one. |
| Greater risk than obesity, inactivity, air pollution | ✅ (2010) | The 2010 paper's comparison figure. |
| Subjective loneliness as damaging as objective isolation | ✅ | 2015 paper. |

### Tiny Habits (Fogg, 2019): book
| Claim | Verdict | Source |
|---|---|---|
| B = MAP | ✅ | **Fogg (2009)**, *A behavior model for persuasive design*, Persuasive '09 (ACM). |
| Willpower is finite | ⚠️ | "Ego depletion" failed a big replication: **Hagger et al. (2016)**, Perspect Psychol Sci 11(4):546–573. Reframe as "motivation fluctuates." |
| Celebration fires a neural reward that rewires the circuit | ❌ | Fogg's own theory, not tested in a study. Attribute it to the book ("Fogg argues…"). Don't present it as a finding. |
| Anchor habits | ✅ | Same evidence as implementation intentions (Milne 2002, Gollwitzer & Sheeran 2006). |

### Nummenmaa et al. (2014): *Bodily maps of emotions*, PNAS 111(2):646–651
| Claim | Verdict | Fix |
|---|---|---|
| Consistent body maps across cultures | ✅ | West European and East Asian samples, n ≈ 700. |
| Sensations are constitutive of emotion | ⚠️ | This is the authors' interpretation. Say "the authors argue." |
| HRV / skin conductance / temperature can be read without self-report | ❌ | **Not in this paper.** It used self-reported colouring on a body outline. For physiology-based emotion detection, see **Kreibig (2010)**, *Autonomic nervous system activity in emotion: a review*, Biol Psychol 84(3):394–421. That review finds the patterns are inconsistent. |
| Body's response precedes awareness by several seconds | ❌ | Not in this paper. Remove. |
| "Why Kairo checks your physical signals first" | ⚠️ | This rests on the two claims above that the paper doesn't make. Rewrite. |

### The Willpower Instinct (McGonigal, 2011): book
| Claim | Verdict | Source |
|---|---|---|
| HRV is a marker of self-control capacity | ⚠️ | **Segerstrom & Nes (2007)**, Psychol Sci 18(3):275–281. It's a correlate, not "the measure." |
| Self-compassion after failure beats self-criticism | ✅ | **Breines & Chen (2012)**, Pers Soc Psychol Bull 38(9):1133–1143. |
| Urge surfing | ✅ | **Bowen & Marlatt (2009)**, Psychol Addict Behav 23(4):666–671. |
| "Willpower depletes" (tagline) | ⚠️ | See Hagger 2016 above. |

### Lost Connections (Hari, 2018): book
| Claim | Verdict | Fix |
|---|---|---|
| 9 causes, 7 social or environmental | ✅ (book's framing) | Hari's thesis, not a scientific consensus. Attribute it to him. |
| Social prescribing = antidepressants in 6-month trials | ❌ | No such trial found. Evidence on social prescribing is mixed and low-quality: **Bickerdike et al. (2017)**, BMJ Open 7:e013384. Remove. |
| Reconnection beats medication alone | ⚠️ | Book opinion. Remove, or attribute it to Hari. |

### The Power of Full Engagement (Loehr & Schwartz, 2003): book
All four points are the book's framework, not research findings. ✅ as long as it stays labelled "Book." Optional peer-reviewed support for effort and recovery: **Sonnentag & Fritz (2007)**, J Occup Health Psychol 12(3):204–221.

### "Plews et al. 2012": HRV-guided training
| Claim | Verdict | Fix |
|---|---|---|
| Title and authors | ⚠️ | Plews et al. 2012 is a **case comparison of 2 triathletes**: *Heart rate variability in elite triathletes, is variation in variability the key to effective training?*, Eur J Appl Physiol 112:3729–3741. The journal is listed wrong too. The HRV-guided training trial is **Kiviniemi et al. (2007)**, *Endurance training guided individually by daily heart rate variability measurements*, Eur J Appl Physiol 101(6):743–751. Bigger trial: **Vesterinen et al. (2016)**, Med Sci Sports Exerc 48(7):1347–1354. |
| 11% greater VO₂max gains | ❌ | Not reported. In Kiviniemi, VO₂peak rose from 56 to 60 ml/kg/min (about 7%) in the HRV group, with no significant change in the fixed-plan group. Use that. |
| HRV drop precedes illness or overtraining by 24–48 h | ❌ | Not established. Remove, or soften to "can flag accumulated fatigue": **Plews et al. (2013)**, Sports Med 43(9):773–781. |
| Individual change beats absolute values | ✅ | Plews 2013 review. |

## 3. How It Works page (`HowItWorksSection.tsx`, signal table)

| Claim | Verdict | Source |
|---|---|---|
| Neurodivergence ~15–20% | ✅ | **Doyle (2020)**, *Neurodiversity at work*, Br Med Bull 135(1):108–125. |
| SSRIs, beta blockers, stimulants affect HR, sleep, energy | ✅ | Standard pharmacology (prescribing labels). Beta blockers lower resting HR. Stimulants raise HR and disrupt sleep. |
| Caregiving measurably increases mortality | ⚠️ | **Schulz & Beach (1999)**, JAMA 282(23):2215–2219: **strained** caregivers had 63% higher mortality. But **Roth et al. (2013)**, Am J Epidemiol 178(10):1571–1578 found caregivers overall had *lower* mortality. Say "high-strain caregiving." |
| Chronotype is biological | ✅ | **Roenneberg et al. (2007)**, Sleep Med Rev 11(6):429–438. Performance by chronotype: **Facer-Childs & Brandstaetter (2015)**, Curr Biol 25(4):518–522. |
| Long sleep latency points to anxiety or rumination | ✅ | **Harvey (2002)**, *A cognitive model of insomnia*, Behav Res Ther 40(8):869–893. |
| Job stress is a top chronic stressor | ✅ | **Goh, Pfeffer & Zenios (2016)**, Manage Sci 62(2):608–628. |
| Bereavement is a major health stressor | ✅ | **Stroebe, Schut & Stroebe (2007)**, *Health outcomes of bereavement*, Lancet 370:1960–1973. |
| Music shifts precede emotional shifts | ❌ | Weak evidence. Remove "precede", or label it a hypothesis. |
| Shift work needs different protocols | ✅ | **IARC Monographs vol. 124 (2020)**, night shift work. |
| Most desk-worker chronic pain is ergonomic | ❌ | Overstated. Evidence for ergonomic interventions is mixed: **Hoe et al. (2018)**, Cochrane CD008570. Soften. |
| High latitude → winter circadian challenges | ✅ | **Rosen et al. (1990)**, *Prevalence of SAD at four latitudes*, Psychiatry Res 31(2):131–144. |
| "1% better every day" | ✅ | Slogan. |

## 4. Shift page (`ShiftSection.tsx`, signal "aids" copy)

| Claim | Verdict | Source |
|---|---|---|
| Cycle phase has a **large** effect on training tolerance | ❌ as worded | **McNulty et al. (2020)**, Sports Med 50(10):1813–1827, 78 studies: the effect on performance is **trivial** and varies by person. Rewrite: "affects people differently, so Kinextion learns your pattern." |
| Purpose independently predicts long-term health | ✅ | **Hill & Turiano (2014)**, Psychol Sci 25(7):1482–1486. **Alimujiang et al. (2019)**, JAMA Netw Open 2(5):e194270. |
| Bedtime regularity matters more than most realise | ✅ | **Windred et al. (2024)**, *Sleep regularity is a stronger predictor of mortality risk than sleep duration*, Sleep 47(1):zsad253 (n = 60,977). The "next-day fatigue" angle is weaker. Lead with this paper. |
| Skin temperature flags illness before symptoms | ✅ | **Mason et al. (2022)**, *Detection of COVID-19 using multimodal data from a wearable device*, Sci Rep 12:3463. |
| Nature walks reduce rumination | ✅ | **Bratman et al. (2015)**, PNAS 112(28):8567–8572. That study compared nature against **urban** walks, not treadmills. Fix the comparison. |
| Light timing anchors circadian rhythm | ✅ | **Blume, Garbazza & Spitschan (2019)**, Somnologie 23(3):147–156. |
| Hydration affects headaches, energy, exercise | ✅ | **Armstrong et al. (2012)**, J Nutr 142(2):382–388. **Ganio et al. (2011)**, Br J Nutr 106(10):1535–1543. |
| Poor air quality and asthma | ✅ | US EPA AirNow guidance. Standard advice. |
| Social withdrawal precedes disengagement | ⚠️ | Plausible, but no clean source found. Label it product reasoning, not a finding. |
| "3-yr memory · 82% pattern match", "screen ↑40%", "caffeine ↑40%" | — | Demo UI values. Fine if they read clearly as an example user. |

---

## Priority fixes (in order)

1. **Stats bar:** advisors, institutions and years of expertise. These are claims about Kinextion itself, so they must be literally true.
2. **Problem page:** 80% / 5+ apps / 4× restarts. These are the headline numbers. Swap 80% for Sperandei's 63%. Drop the other two, or mark them as survey data.
3. **Nummenmaa card:** two findings aren't in the paper, and Kairo's rationale rests on them.
4. **"Plews 2012" card:** wrong paper, and an 11% figure that doesn't exist.
5. **Holt-Lunstad and Harvard cards:** numbers from different papers are mixed together.
6. **Hari social prescribing**, **Fogg celebration**, **cycle-phase "large effect"**.
