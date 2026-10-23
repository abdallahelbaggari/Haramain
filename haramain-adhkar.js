/* Haramain — Morning & Evening Adhkar (Hisn al-Muslim). Tap counter, progress, daily completion,
   real recitation for the Quranic parts, Arabic read-aloud for the rest when the phone has an Arabic voice. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* m = morning text, e = evening text (when different); q = Quran verses to recite [surah, from, to] */
  var A = [
    { id: 'kursi', n: 1, ref: 'Quran 2:255 · Hakim', q: [[2, 255, 255]],
      m: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
      tr: 'Ayat al-Kursi', en: 'Allah — there is no god except Him, the Ever-Living, the Sustainer of all existence… (The Verse of the Throne). Whoever recites it in the morning is protected until evening.' },
    { id: 'quls', n: 3, ref: 'Quran 112, 113, 114 · Abu Dawud, Tirmidhi', q: [[112, 1, 4], [113, 1, 5], [114, 1, 6]],
      m: 'قُلْ هُوَ اللَّهُ أَحَدٌ … · قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ … · قُلْ أَعُوذُ بِرَبِّ النَّاسِ …',
      tr: 'Surah Al-Ikhlas, Al-Falaq and An-Nas', en: 'Recite the three surahs three times each. “They will suffice you against everything.”' },
    { id: 'mulk', n: 1, ref: 'Muslim',
      m: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
      e: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
      tr: 'Asbahna wa asbahal-mulku lillah… (evening: Amsayna wa amsal-mulku lillah…)', en: 'We have entered the morning (evening) and the dominion belongs to Allah. Praise is for Allah… My Lord, I ask You for the good of this day (night) and what follows it, and I seek refuge in You from its evil and the evil of what follows it. My Lord, I seek refuge in You from laziness and the misery of old age, and from punishment in the Fire and in the grave.' },
    { id: 'bika', n: 1, ref: 'Tirmidhi',
      m: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
      e: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ',
      tr: 'Allahumma bika asbahna wa bika amsayna, wa bika nahya wa bika namut, wa ilaykan-nushur (evening: …wa ilaykal-masir)', en: 'O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the resurrection (evening: the final return).' },
    { id: 'sayyid', n: 1, ref: 'Bukhari',
      m: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
      tr: 'Sayyid al-Istighfar: Allahumma anta rabbi la ilaha illa ant…', en: 'The best way of seeking forgiveness: O Allah, You are my Lord, none has the right to be worshipped but You. You created me and I am Your servant… Forgive me, for none forgives sins but You.' },
    { id: 'ushhiduk', n: 4, ref: 'Abu Dawud',
      m: 'اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلَائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَٰهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ',
      e: 'اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلَائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَٰهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ',
      tr: 'Allahumma inni asbahtu (amsaytu) ushhiduka…', en: 'O Allah, this morning (evening) I call on You, the bearers of Your Throne, Your angels and all Your creation to witness that You are Allah, none has the right to be worshipped but You alone, and that Muhammad is Your servant and Messenger.' },
    { id: 'nimah', n: 1, ref: 'Abu Dawud',
      m: 'اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ',
      e: 'اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ',
      tr: 'Allahumma ma asbaha (amsa) bi min ni‘matin…', en: 'O Allah, whatever blessing I or any of Your creation have this morning (evening) is from You alone, without partner. To You belong all praise and thanks.' },
    { id: 'afini', n: 3, ref: 'Abu Dawud',
      m: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَٰهَ إِلَّا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لَا إِلَٰهَ إِلَّا أَنْتَ',
      tr: 'Allahumma ‘afini fi badani, Allahumma ‘afini fi sam‘i, Allahumma ‘afini fi basari…', en: 'O Allah, grant me health in my body, my hearing and my sight; none has the right to be worshipped but You. O Allah, I seek refuge in You from disbelief and poverty, and from the punishment of the grave.' },
    { id: 'hasbi', n: 7, ref: 'Abu Dawud',
      m: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
      tr: 'Hasbiyallahu la ilaha illa huwa, ‘alayhi tawakkaltu wa huwa rabbul-‘arshil-‘azim', en: 'Allah is sufficient for me; none has the right to be worshipped but Him. In Him I trust, and He is the Lord of the Mighty Throne.' },
    { id: 'afw', n: 1, ref: 'Abu Dawud, Ibn Majah',
      m: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي وَعَنْ يَمِينِي وَعَنْ شِمَالِي وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي',
      tr: 'Allahumma inni as’alukal-‘afwa wal-‘afiyah…', en: 'O Allah, I ask You for pardon and well-being in this world and the Hereafter, in my religion, my worldly life, my family and my wealth. Cover my faults, calm my fears, and protect me from every side.' },
    { id: 'alim', n: 1, ref: 'Tirmidhi, Abu Dawud',
      m: 'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَىٰ نَفْسِي سُوءًا أَوْ أَجُرَّهُ إِلَىٰ مُسْلِمٍ',
      tr: 'Allahumma ‘alimal-ghaybi wash-shahadah…', en: 'O Allah, Knower of the unseen and the seen, Creator of the heavens and the earth, Lord and Owner of everything: I seek refuge in You from the evil of myself and of Shaytan, and from wronging myself or another Muslim.' },
    { id: 'bismillah', n: 3, ref: 'Abu Dawud, Tirmidhi',
      m: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
      tr: 'Bismillahil-ladhi la yadurru ma‘asmihi shay’un fil-ardi wa la fis-sama’, wa huwas-sami‘ul-‘alim', en: 'In the name of Allah, with whose name nothing on earth or in the heavens can cause harm, and He is the All-Hearing, the All-Knowing.' },
    { id: 'raditu', n: 3, ref: 'Abu Dawud, Tirmidhi',
      m: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا',
      tr: 'Raditu billahi rabba, wa bil-islami dina, wa bi-Muhammadin ﷺ nabiyya', en: 'I am pleased with Allah as my Lord, with Islam as my religion and with Muhammad ﷺ as my Prophet.' },
    { id: 'hayy', n: 1, ref: 'Hakim, Nasa’i',
      m: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَىٰ نَفْسِي طَرْفَةَ عَيْنٍ',
      tr: 'Ya Hayyu ya Qayyum, bi-rahmatika astaghith…', en: 'O Ever-Living, O Sustainer, by Your mercy I seek help: set right all my affairs and do not leave me to myself even for the blink of an eye.' },
    { id: 'fitrah', n: 1, ref: 'Ahmad',
      m: 'أَصْبَحْنَا عَلَىٰ فِطْرَةِ الْإِسْلَامِ، وَعَلَىٰ كَلِمَةِ الْإِخْلَاصِ، وَعَلَىٰ دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَىٰ مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ',
      e: 'أَمْسَيْنَا عَلَىٰ فِطْرَةِ الْإِسْلَامِ، وَعَلَىٰ كَلِمَةِ الْإِخْلَاصِ، وَعَلَىٰ دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَىٰ مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ',
      tr: 'Asbahna (Amsayna) ‘ala fitratil-islam…', en: 'We have entered the morning (evening) upon the natural way of Islam, the word of sincerity, the religion of our Prophet Muhammad ﷺ and the way of our father Ibrahim, upright and Muslim, who was not of those who associate partners with Allah.' },
    { id: 'subhan100', n: 100, ref: 'Muslim',
      m: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
      tr: 'SubhanAllahi wa bihamdihi', en: 'Glory be to Allah and praise be to Him. Whoever says it 100 times, morning and evening, no one will bring anything better on the Day of Resurrection except someone who said the same or more.' },
    { id: 'tahlil', n: 10, ref: 'Nasa’i (10 times); Bukhari and Muslim (100 times)',
      m: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
      tr: 'La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa ‘ala kulli shay’in qadir', en: 'None has the right to be worshipped but Allah alone, without partner. His is the dominion and the praise, and He is able to do all things.' },
    { id: 'adada', n: 3, ref: 'Muslim', only: 'm',
      m: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ',
      tr: 'SubhanAllahi wa bihamdihi ‘adada khalqihi, wa rida nafsihi, wa zinata ‘arshihi, wa midada kalimatihi', en: 'Glory be to Allah and praise be to Him, as many times as the number of His creation, as much as pleases Him, as much as the weight of His Throne and the ink of His words.' },
    { id: 'ilman', n: 1, ref: 'Ibn Majah', only: 'm',
      m: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا',
      tr: 'Allahumma inni as’aluka ‘ilman nafi‘an, wa rizqan tayyiban, wa ‘amalan mutaqabbala', en: 'O Allah, I ask You for beneficial knowledge, good provision and deeds that are accepted.' },
    { id: 'istighfar', n: 100, ref: 'Bukhari, Muslim', only: 'm',
      m: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
      tr: 'Astaghfirullaha wa atubu ilayh', en: 'I seek Allah’s forgiveness and turn to Him in repentance.' },
    { id: 'kalimat', n: 3, ref: 'Muslim', only: 'e',
      m: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
      tr: 'A‘udhu bi-kalimatillahit-tammati min sharri ma khalaq', en: 'I seek refuge in the perfect words of Allah from the evil of what He has created.' },
    { id: 'salawat', n: 10, ref: 'Tabarani',
      m: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَىٰ نَبِيِّنَا مُحَمَّدٍ',
      tr: 'Allahumma salli wa sallim ‘ala nabiyyina Muhammad', en: 'O Allah, send blessings and peace upon our Prophet Muhammad. Whoever does so ten times in the morning and ten in the evening will have his intercession.' }
  ];
  function list(t) { return A.filter(function (x) { return !x.only || x.only === t; }); }
  function day() { return new Date().toDateString(); }
  function state(t) { var s = get('adk_' + t, null); if (!s || s.day !== day()) s = { day: day(), c: {} }; return s; }
  function save(t, s) { put('adk_' + t, s); }
  function doneCount(t) { var s = state(t); return list(t).filter(function (x) { return (s.c[x.id] || 0) >= x.n; }).length; }
  window.HMA = { done: doneCount, total: function (t) { return list(t).length; } };
  var cur = (new Date().getHours() >= 12 ? 'e' : 'm');

  function screen() {
    if ($('s-adhkar')) return;
    var sec = document.createElement('section'); sec.className = 'scr'; sec.id = 's-adhkar';
    ($('main') || document.body).appendChild(sec);
  }
  function render() {
    var sec = $('s-adhkar'); if (!sec) return;
    var L = list(cur), s = state(cur), d = doneCount(cur);
    sec.innerHTML = '<div class="scr-top-bar"><div><div class="scr-top-title">' + (cur === 'm' ? '☀️ Morning Adhkar' : '🌙 Evening Adhkar') + '</div><div class="scr-top-sub">Hisn al-Muslim · after Fajr / after Asr</div></div></div>' +
      '<div class="hl-tabs"><button type="button" class="' + (cur === 'm' ? 'on' : '') + '" onclick="HMA.tab(\'m\')">☀️ Morning ' + doneCount('m') + '/' + list('m').length + '</button><button type="button" class="' + (cur === 'e' ? 'on' : '') + '" onclick="HMA.tab(\'e\')">🌙 Evening ' + doneCount('e') + '/' + list('e').length + '</button></div>' +
      '<div class="ad-prog"><span style="width:' + Math.round(d / L.length * 100) + '%"></span></div><div class="ad-progt">' + (d === L.length ? '✅ All done for today. May Allah accept it.' : d + ' of ' + L.length + ' done') + '</div>' +
      L.map(function (x, i) {
        var c = s.c[x.id] || 0, ok = c >= x.n, txt = (cur === 'e' && x.e) ? x.e : x.m;
        return '<div class="ad-card' + (ok ? ' ok' : '') + '" id="ad-' + x.id + '"><div class="ad-top"><span class="ad-n">' + (i + 1) + '</span><span class="ad-src">' + esc(x.ref) + '</span>' +
          (x.q || arVoice() ? '<button type="button" class="ad-play" onclick="HMA.play(\'' + x.id + '\')" aria-label="Listen">🔊</button>' : '') + '</div>' +
          '<div class="ad-ar" lang="ar" dir="rtl">' + esc(txt) + '</div><div class="ad-tr">' + esc(x.tr) + '</div><div class="ad-en">' + esc(x.en) + '</div>' +
          '<button type="button" class="ad-count" onclick="HMA.tap(\'' + x.id + '\')">' + (ok ? '✓ Done' : (x.n > 1 ? 'Tap to count · <b>' + c + '</b> / ' + x.n : 'Tap when read')) + '</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="HMA.reset()" style="margin:6px 0 16px">↺ Start again</button>';
  }
  function arVoice() { try { return speechSynthesis.getVoices().some(function (v) { return /^ar/i.test(v.lang); }); } catch (e) { return false; } }

  /* audio: real recitation for Quranic adhkar, Arabic voice for the rest */
  var au = new Audio(), queue = [];
  function pad(x) { return ('00' + x).slice(-3); }
  function playQueue() { if (!queue.length) return; var f = queue.shift(); au.src = 'https://everyayah.com/data/Alafasy_128kbps/' + f + '.mp3'; au.onended = playQueue; au.onerror = function () { au.src = '/quran-audio?r=alafasy&s=' + parseInt(f.slice(0, 3), 10) + '&a=' + parseInt(f.slice(3), 10); au.onerror = playQueue; au.play().catch(function () {}); }; au.play().catch(function () {}); }
  window.HMA.play = function (id) {
    var x = A.filter(function (a) { return a.id === id; })[0]; if (!x) return;
    try { speechSynthesis.cancel(); } catch (e) {} au.pause(); queue = [];
    if (x.q) { x.q.forEach(function (r) { if (r[0] !== 2) queue.push('001001'); for (var a = r[1]; a <= r[2]; a++) queue.push(pad(r[0]) + pad(a)); }); say('🔊 Mishary Alafasy'); playQueue(); return; }
    var v = speechSynthesis.getVoices().filter(function (v) { return /^ar/i.test(v.lang); })[0]; if (!v) return;
    var u = new SpeechSynthesisUtterance((cur === 'e' && x.e) ? x.e : x.m); u.voice = v; u.lang = v.lang; u.rate = .85; speechSynthesis.speak(u);
  };
  window.HMA.tap = function (id) {
    var s = state(cur), x = A.filter(function (a) { return a.id === id; })[0]; if (!x) return;
    var c = (s.c[id] || 0); if (c >= x.n) return;
    s.c[id] = c + 1; save(cur, s);
    try { if (navigator.vibrate) navigator.vibrate(s.c[id] >= x.n ? [20, 40, 20] : 12); } catch (e) {}
    if (s.c[id] >= x.n) {
      render(); var L = list(cur), i = L.indexOf(x), nx = L.slice(i + 1).filter(function (y) { return (s.c[y.id] || 0) < y.n; })[0] || L.filter(function (y) { return (s.c[y.id] || 0) < y.n; })[0];
      if (nx) setTimeout(function () { var e = $('ad-' + nx.id); if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 120);
      else say('✅ ' + (cur === 'm' ? 'Morning' : 'Evening') + ' adhkar complete. May Allah accept it.');
    } else { var b = document.querySelector('#ad-' + id + ' .ad-count b'); if (b) b.textContent = s.c[id]; }
    try { window.dispatchEvent(new Event('hm-adhkar')); } catch (e) {}
  };
  window.HMA.tab = function (t) { cur = t; render(); try { $('main').scrollTop = 0; } catch (e) {} window.scrollTo(0, 0); };
  window.HMA.reset = function () { if (!confirm('Start this list again from zero?')) return; save(cur, { day: day(), c: {} }); render(); };
  window.HMA.open = function (t) { if (t) cur = t; goS('adhkar'); };

  function start() {
    screen();
    var _goS = window.goS;
    window.goS = function (id) {
      if (id === 'audio') id = 'adhkar';
      if (id === 'adhkar') {
        document.querySelectorAll('.scr').forEach(function (s) { s.classList.remove('on'); });
        document.querySelectorAll('.bni').forEach(function (b) { b.classList.remove('on'); });
        $('s-adhkar').classList.add('on'); render(); try { $('main').scrollTop = 0; } catch (e) {} window.scrollTo(0, 0); return;
      }
      return _goS.apply(this, arguments);
    };
    try { speechSynthesis.onvoiceschanged = function () { if ($('s-adhkar').classList.contains('on')) render(); }; } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 70); }); else setTimeout(start, 70);
})();
