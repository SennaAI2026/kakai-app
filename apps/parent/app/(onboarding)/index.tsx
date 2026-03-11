import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, ImageBackground,
  Dimensions, ScrollView, StatusBar, ActivityIndicator, Share, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';
import { INVITE_CODE_LENGTH } from '@kakai/shared';

const { width: W, height: H } = Dimensions.get('window');
const GREEN = '#2DB573';
const DARK = '#1A1A2E';
const BG = '#F0F2F5';
const GRAY = '#6B7280';
const LIGHT_GRAY = '#E5E7EB';
const YELLOW = '#FEF3C7';
const DOT_COUNT = 7;
const SLIDE_COUNT = 15;
const IMG_BG = '#D5D8DC';

const IMAGES = {
  mascot: require('../../assets/giraffe_10_mascot.png'),
  welcome: require('../../assets/giraffe_welcome.png'),
  block: require('../../assets/giraffe_block.png'),
  sleep: require('../../assets/giraffe_sleep.png'),
  youtube: require('../../assets/giraffe_youtube.png'),
  limit: require('../../assets/giraffe_limit.png'),
  tasks: require('../../assets/giraffe_tasks.png'),
  gps: require('../../assets/giraffe_gps.png'),
  rating: require('../../assets/giraffe_rating.png'),
  roleBg: require('../../assets/giraffe_role_bg.png'),
  couplePhoto: require('../../assets/couple_photo.png'),
  parentIcon: require('../../assets/parent-icon-512.png'),
  childIcon: require('../../assets/child-icon-512.png'),
  bgLight: require('../../assets/bg_light.png'),
  mascotClean: require('../../assets/giraffe_mascot_clean.png'),
  waitingSetup: require('../../assets/giraffe_waiting_setup.png'),
};

// --- Translations ---

const translations = {
  kz: {
    welcomeTitle: 'Баланың телефонына\nшектеу қойыңыз',
    welcomeSub: '«kakai» — аналар мен әкелер бала зиянды нәрсеге қол созғанда айтады. Телефон — да солай.',
    blockTitle: 'Қосымшаларға кіруді\nбір басумен бұғаттаңыз',
    sleepTitle: 'Ұйқы мен оқу уақытында\nқосымшаларға кіруді шектеңіз',
    youtubeTitle: 'Сайттар мен YouTube\nкіруді бақылаңыз',
    limitTitle: 'Күнделікті уақыт шегін\nойын-сауық үшін белгілеңіз',
    tasksTitle: 'Күнделікті лимитті пайдалы\nтапсырмалар орындау арқылы\nарттырыңыз',
    gpsTitle: 'Бала мектептен шыққанда\nавтоматты хабарлама алыңыз',
    gpsNotif: 'Бала мектептен шықты',
    start: 'Бастау',
    skip: 'Өткізу',
    surveyBubble: 'Біз туралы қайдан білдіңіз?',
    surveyOpt1: 'YouTube немесе онлайн-видео',
    surveyOpt2: 'Достар немесе отбасы ұсынысы',
    surveyOpt3: 'Instagram немесе TikTok',
    surveyOpt4: 'Дәрігер немесе маман',
    surveyOpt5: 'App Store / Google Play',
    surveyOpt6: 'Блогер немесе ата-ана форумы',
    surveyOpt7: 'Басқа',
    ratingTitle: 'Бағалағаныңыз үшін\nрахмет',
    continue: 'Жалғастыру',
    pushTitle: 'Хабарламаларды қосыңыз,\nмаңызды ақпаратты\nжіберіп алмау үшін',
    allow: 'Қосу',
    later: 'Кейінірек',
    roleTitle: 'Бұл құрылғыны кім пайдаланады?',
    parent: 'Ата-ана',
    parentSub: 'Бұл менің телефоным',
    child: 'Бала',
    childSub: 'Бұл баланың телефоны',
    back: 'Артқа',
    kakaiParent: 'Ата-ана үшін',
    kakaiBala: 'Бала үшін',
    stepDone: 'Kakai ата-ана телефонына орнатылды',
    stepNext: 'Баланың телефонын баптайық',
    setupChild: 'Баланың телефонын баптау',
    sendLinkTitle: 'Баланың телефонын баптау үшін, оған Kakai Bala қосымшасына сілтеме жіберіңіз',
    sendLinkDesc: 'Kakai Bala қосымшасы баланың деректерін ата-ана қосымшасы Kakai-ге жібереді',
    sendLink: 'Балаға сілтеме жіберу',
    otherMethod: 'Басқа тәсіл',
    waitingTitle: 'Баланың телефонында жіберілген сілтемеге өтіңіз, Kakai Бала қосымшасын орнатыңыз және кодты енгізіңіз:',
    waitingHint: 'Бұл код Kakai Бала қосымшасын сіздің Kakai қосымшаңызбен байланыстырады!',
    needHelp: 'Маған көмек керек',
    waitingSetupTitle: 'Баланың телефонында\nбаптауды жалғастырыңыз',
    waitingSetupDesc: 'Бұл бірнеше минут алады',
    childReady: 'Бала баптанды, жалғастыру',
    getHelp: 'Көмек алу',
    helpInstructions: '1. Баланың телефонында Kakai Бала қосымшасын ашыңыз\n2. Шақыру кодын енгізіңіз\n3. Экрандағы нұсқауларды орындаңыз',
  },
  ru: {
    welcomeTitle: 'Установите лимиты\nдля телефона ребёнка',
    welcomeSub: '«kakai» — так мамы и папы говорят когда ребёнок тянется к чему-то вредному. Телефон — тоже.',
    blockTitle: 'Блокируйте доступ\nк приложениям одним\nнажатием',
    sleepTitle: 'Ограничивайте доступ\nк приложениям на время\nсна и учёбы',
    youtubeTitle: 'Контролируйте посещение\nсайтов и просмотры\nна YouTube',
    limitTitle: 'Установите дневной лимит\nвремени для развлечений\nв телефоне',
    tasksTitle: 'Увеличивайте дневной лимит\nза выполнение полезных\nзаданий',
    gpsTitle: 'Автоматически получайте\nуведомления когда ребёнок\nвыходит из школы',
    gpsNotif: 'Ребёнок вышел из школы',
    start: 'Начать',
    skip: 'Пропустить',
    surveyBubble: 'Откуда вы узнали о нас?',
    surveyOpt1: 'YouTube или онлайн-видео',
    surveyOpt2: 'Рекомендация друзей или семьи',
    surveyOpt3: 'Instagram или TikTok',
    surveyOpt4: 'Педиатр или специалист',
    surveyOpt5: 'App Store / Google Play',
    surveyOpt6: 'Блогер или родительский форум',
    surveyOpt7: 'Другое',
    ratingTitle: 'Спасибо за вашу\nоценку',
    continue: 'Продолжить',
    pushTitle: 'Включите уведомления\nчтобы не пропустить\nважное',
    allow: 'Включить',
    later: 'Не сейчас',
    roleTitle: 'Кто будет пользоваться этим устройством?',
    parent: 'Родитель',
    parentSub: 'Это мой телефон',
    child: 'Ребёнок',
    childSub: 'Это телефон ребёнка',
    back: 'Назад',
    kakaiParent: 'Для родителя',
    kakaiBala: 'Для ребёнка',
    stepDone: 'Kakai установлено на телефон родителя',
    stepNext: 'Давайте настроим телефон ребёнка',
    setupChild: 'Настроить телефон ребёнка',
    sendLinkTitle: 'Чтобы настроить телефон ребёнка, отправьте ему ссылку на детское приложение Kakai Bala',
    sendLinkDesc: 'Приложение Kakai Bala отправляет данные ребёнка на родительское приложение Kakai',
    sendLink: 'Отправить ссылку ребёнку',
    otherMethod: 'Другой способ',
    waitingTitle: 'На телефоне ребёнка перейдите по отправленной ссылке, установите приложение Kakai Бала и введите в нём код:',
    waitingHint: 'Этот код свяжет приложение Kakai Бала с вашим родительским приложением Kakai и всё заработает!',
    needHelp: 'Мне нужна помощь',
    waitingSetupTitle: 'Продолжите настройку\nна телефоне ребёнка',
    waitingSetupDesc: 'Это займёт несколько минут',
    childReady: 'Ребёнок настроен, продолжить',
    getHelp: 'Получить помощь',
    helpInstructions: '1. Откройте Kakai Бала на телефоне ребёнка\n2. Введите код приглашения\n3. Следуйте инструкциям на экране',
  },
  en: {
    welcomeTitle: 'Set limits for\nyour child\'s phone',
    welcomeSub: '"kakai" is what parents say when a child reaches for something harmful. The phone counts too.',
    blockTitle: 'Block access to apps\nwith a single tap',
    sleepTitle: 'Restrict access to apps\nduring sleep and\nschool hours',
    youtubeTitle: 'Control website visits\nand YouTube viewing',
    limitTitle: 'Set a daily time limit\nfor entertainment\non the phone',
    tasksTitle: 'Increase daily limit\nby completing useful\ntasks',
    gpsTitle: 'Automatically get notifications\nwhen your child leaves\nschool',
    gpsNotif: 'Child left school',
    start: 'Get Started',
    skip: 'Skip',
    surveyBubble: 'How did you hear about us?',
    surveyOpt1: 'YouTube or online video',
    surveyOpt2: 'Friends or family recommendation',
    surveyOpt3: 'Instagram or TikTok',
    surveyOpt4: 'Pediatrician or specialist',
    surveyOpt5: 'App Store / Google Play',
    surveyOpt6: 'Blogger or parenting forum',
    surveyOpt7: 'Other',
    ratingTitle: 'Thank you for\nyour rating',
    continue: 'Continue',
    pushTitle: 'Enable notifications\nso you don\'t miss\nanything important',
    allow: 'Enable',
    later: 'Not now',
    roleTitle: 'Who will be using this device?',
    parent: 'Parent',
    parentSub: 'This is my phone',
    child: 'Child',
    childSub: 'This is the child\'s phone',
    back: 'Back',
    kakaiParent: 'For parent',
    kakaiBala: 'For child',
    stepDone: 'Kakai installed on parent\'s phone',
    stepNext: 'Let\'s set up the child\'s phone',
    setupChild: 'Set up child\'s phone',
    sendLinkTitle: 'To set up the child\'s phone, send them a link to the Kakai Bala app',
    sendLinkDesc: 'The Kakai Bala app sends the child\'s data to the parent Kakai app',
    sendLink: 'Send link to child',
    otherMethod: 'Other method',
    waitingTitle: 'On the child\'s phone, follow the link, install Kakai Bala app and enter this code:',
    waitingHint: 'This code will link the Kakai Bala app with your parent Kakai app and everything will work!',
    needHelp: 'I need help',
    waitingSetupTitle: 'Continue setup on\nyour child\'s phone',
    waitingSetupDesc: 'This will take a few minutes',
    childReady: 'Child is set up, continue',
    getHelp: 'Get help',
    helpInstructions: '1. Open Kakai Bala on the child\'s phone\n2. Enter the invite code\n3. Follow the on-screen instructions',
  },
};

type Lang = keyof typeof translations;
type T = (typeof translations)['ru'];

const LANGS: { key: Lang; label: string }[] = [
  { key: 'kz', label: 'KZ \u049Aa\u0437' },
  { key: 'ru', label: 'RU \u0420\u0443\u0441' },
  { key: 'en', label: 'EN Eng' },
];

// --- Reusable Components ---

function BgImage({ source, resizeMode = 'cover', bgColor, children }: {
  source: any;
  resizeMode?: 'cover' | 'contain';
  bgColor?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, { flex: 1 }, bgColor ? { backgroundColor: bgColor } : null]}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
      />
      <View style={[StyleSheet.absoluteFill, { zIndex: 1 }]}>
        {children}
      </View>
    </View>
  );
}

function LangPicker({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <View style={lp.row}>
      {LANGS.map((l) => (
        <TouchableOpacity
          key={l.key}
          style={[lp.chip, lang === l.key && lp.active]}
          onPress={() => onChange(l.key)}
          activeOpacity={0.7}
        >
          <Text style={[lp.label, lang === l.key && lp.labelActive]}>{l.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const lp = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  active: { borderColor: GREEN, backgroundColor: GREEN },
  label: { fontSize: 13, fontWeight: '600', color: GRAY },
  labelActive: { color: '#fff' },
});

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={dt.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[dt.dot, i === active && dt.dotActive]} />
      ))}
    </View>
  );
}
const dt = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: GREEN },
});

function GreenBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[gb.btn, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text style={gb.text}>{label}</Text>
    </TouchableOpacity>
  );
}
const gb = StyleSheet.create({
  btn: { backgroundColor: GREEN, borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginHorizontal: 20 },
  text: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[cc.card, style]}>{children}</View>;
}
const cc = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, marginHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
});

function Bubble({ text }: { text: string }) {
  return (
    <View style={bb.bubble}>
      <Text style={bb.text}>{text}</Text>
    </View>
  );
}
const bb = StyleSheet.create({
  bubble: { backgroundColor: YELLOW, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 6 },
  text: { fontSize: 15, fontWeight: '600', color: DARK },
});

// --- SLIDE 0 - Welcome (contain image + white card bottom) ---

function Slide0({ t, lang, setLang, onNext }: { t: T; lang: Lang; setLang: (l: Lang) => void; onNext: () => void }) {
  return (
    <TouchableOpacity style={{ flex: 1, backgroundColor: IMG_BG }} activeOpacity={1} onPress={onNext}>
      <View style={{ position: 'absolute', top: 50, alignSelf: 'center', zIndex: 10 }}>
        <LangPicker lang={lang} onChange={setLang} />
      </View>

      <View style={{ flex: 3, justifyContent: 'center', alignItems: 'center' }}>
        <Image source={IMAGES.welcome} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </View>

      <View style={slide.bottomCard}>
        <Text style={slide.title}>{t.welcomeTitle}</Text>
        <Text style={{ fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 20, marginTop: 8 }}>
          {t.welcomeSub}
        </Text>
        <Dots count={DOT_COUNT} active={0} />
      </View>
    </TouchableOpacity>
  );
}

// --- SLIDES 1-5 - Feature slides (contain image + white card bottom) ---

function FeatureSlide({ t, imageSource, title, dotIndex, onNext, bgColor }: {
  t: T; imageSource: any; title: string; dotIndex: number; onNext: () => void; bgColor?: string;
}) {
  return (
    <TouchableOpacity style={{ flex: 1, backgroundColor: bgColor || IMG_BG }} activeOpacity={1} onPress={onNext}>
      <View style={{ flex: 3, justifyContent: 'center', alignItems: 'center' }}>
        <Image source={imageSource} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </View>

      <View style={slide.bottomCard}>
        <Text style={slide.title}>{title}</Text>
        <Dots count={DOT_COUNT} active={dotIndex} />
      </View>
    </TouchableOpacity>
  );
}

// --- SLIDE 6 - GPS (contain image + white card + green button) ---

function Slide6({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: IMG_BG }}>
      <View style={{ flex: 3, justifyContent: 'center', alignItems: 'center' }}>
        <Image source={IMAGES.gps} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </View>

      <View style={slide.bottomCard}>
        <Text style={slide.title}>{t.gpsTitle}</Text>
        <View style={{ paddingTop: 12 }}>
          <GreenBtn label={t.start} onPress={onNext} />
        </View>
        <Dots count={DOT_COUNT} active={6} />
      </View>
    </View>
  );
}

// --- SLIDE 7 - Survey (no mascot, just bubble + options) ---

function Slide7({ t, onSelect, onSkip }: { t: T; onSelect: (v: string) => void; onSkip: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const options = [t.surveyOpt1, t.surveyOpt2, t.surveyOpt3, t.surveyOpt4, t.surveyOpt5, t.surveyOpt6, t.surveyOpt7];

  function handleSelect(i: number) {
    if (selected !== null) return;
    setSelected(i);
    timerRef.current = setTimeout(() => onSelect(options[i]), 400);
  }

  return (
    <BgImage source={IMAGES.bgLight}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={s7.skipBtn} onPress={onSkip} activeOpacity={0.7}>
          <Text style={s7.skipText}>{t.skip}</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', paddingTop: 32 }}>
            <Bubble text={t.surveyBubble} />
          </View>

          <View style={{ gap: 8, paddingHorizontal: 20, marginTop: 16 }}>
            {options.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[s7.option, selected === i && s7.optionSelected]}
                onPress={() => handleSelect(i)}
                activeOpacity={0.7}
              >
                <Text style={s7.optionText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </BgImage>
  );
}
const s7 = StyleSheet.create({
  skipBtn: { position: 'absolute', top: 54, right: 20, zIndex: 10, padding: 8 },
  skipText: { fontSize: 15, fontWeight: '600', color: GRAY },
  option: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20, borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  optionSelected: { borderColor: GREEN },
  optionText: { fontSize: 16, fontWeight: '600', color: DARK },
});

// --- SLIDE 8 - Rating (unchanged - looks good) ---

function Slide8({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <BgImage source={IMAGES.rating}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 28, paddingBottom: 34, paddingHorizontal: 20, minHeight: '35%' }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: DARK, textAlign: 'center', lineHeight: 32 }}>
            {t.ratingTitle}
          </Text>
          <View style={{ flex: 1 }} />
          <GreenBtn label={t.continue} onPress={onNext} />
        </View>
      </View>
    </BgImage>
  );
}

// --- SLIDE 9 - Push (pre-screen only, real permission in dev build later) ---

function Slide9({ t, onAllow, onLater }: { t: T; onAllow: () => void; onLater: () => void }) {
  return (
    <BgImage source={IMAGES.bgLight}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <View style={{ width: 100, height: 100, borderRadius: 28, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }}>
          <Text style={{ fontSize: 48 }}>🔔</Text>
        </View>

        <Text style={{ fontSize: 22, fontWeight: '800', color: DARK, textAlign: 'center', lineHeight: 30, marginTop: 28 }}>
          {t.pushTitle}
        </Text>

        <View style={{ width: '100%', marginTop: 40, gap: 12 }}>
          <GreenBtn label={t.allow} onPress={onAllow} />
          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={onLater} activeOpacity={0.7}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: GRAY }}>{t.later}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </BgImage>
  );
}

// --- SLIDE 10 - Role Selection (unchanged - looks good) ---

function Slide10({ t, role, setRole, onNext, loading }: { t: T; role: 'parent' | 'child' | null; setRole: (r: 'parent' | 'child') => void; onNext: () => void; loading?: boolean }) {
  function RoleCard({ value, label, sub }: { value: 'parent' | 'child'; label: string; sub: string }) {
    const active = role === value;
    return (
      <TouchableOpacity
        style={[s10.card, active && s10.cardActive]}
        onPress={() => setRole(value)}
        activeOpacity={0.8}
      >
        <View style={[s10.radio, active && s10.radioActive]}>
          {active && <View style={s10.radioInner} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s10.cardLabel, active && { color: '#fff' }]}>{label}</Text>
          <Text style={[s10.cardSub, active && { color: 'rgba(255,255,255,0.85)' }]}>{sub}</Text>
        </View>
        {value === 'parent' ? (
          <Image source={IMAGES.couplePhoto} style={{ width: 50, height: 50, borderRadius: 25 }} />
        ) : (
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: active ? 'rgba(255,255,255,0.2)' : LIGHT_GRAY }} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <BgImage source={IMAGES.roleBg}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }}>
        <Text style={s10.heading}>{t.roleTitle}</Text>
        <View style={{ gap: 12, paddingHorizontal: 20, marginTop: 20 }}>
          <RoleCard value="parent" label={t.parent} sub={t.parentSub} />
          <RoleCard value="child" label={t.child} sub={t.childSub} />
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ paddingBottom: 24 }}>
          <GreenBtn label={loading ? '...' : t.continue} onPress={onNext} disabled={role === null || !!loading} />
        </View>
      </SafeAreaView>
    </BgImage>
  );
}
const s10 = StyleSheet.create({
  heading: { fontSize: 26, fontWeight: '800', color: DARK, lineHeight: 34, paddingHorizontal: 24, marginTop: 20, textAlign: 'left' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 14, borderWidth: 1, borderColor: LIGHT_GRAY },
  cardActive: { backgroundColor: GREEN, borderColor: GREEN },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: 'rgba(255,255,255,0.6)' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  cardLabel: { fontSize: 18, fontWeight: '700', color: DARK },
  cardSub: { fontSize: 14, color: GRAY, marginTop: 2 },
});

// --- SLIDE 11 - Stepper (no mascot) ---

function Slide11({ t, onNext, onBack }: { t: T; onNext: () => void; onBack: () => void }) {
  return (
    <BgImage source={IMAGES.bgLight}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={s11.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={s11.backText}>{'\u2190'} {t.back}</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, justifyContent: 'center', paddingTop: 40 }}>
          <Card style={{ gap: 24 }}>
            <View style={s11.appsRow}>
              <View style={s11.appCol}>
                <Image source={IMAGES.parentIcon} style={{ width: 72, height: 72, borderRadius: 18 }} />
                <Text style={s11.appName}>Kakai</Text>
                <Text style={s11.appRole}>{t.kakaiParent}</Text>
              </View>
              <Text style={s11.plus}>+</Text>
              <View style={s11.appCol}>
                <Image source={IMAGES.childIcon} style={{ width: 72, height: 72, borderRadius: 18 }} />
                <Text style={s11.appName}>Kakai Bala</Text>
                <Text style={s11.appRole}>{t.kakaiBala}</Text>
              </View>
            </View>

            <View>
              <View style={s11.stepRow}>
                <View style={s11.stepDone}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{'\u2713'}</Text>
                </View>
                <Text style={[s11.stepText, { fontWeight: '700' }]}>{t.stepDone}</Text>
              </View>
              <View style={s11.stepLine} />
              <View style={s11.stepRow}>
                <View style={s11.stepPending} />
                <Text style={[s11.stepText, { color: GRAY }]}>{t.stepNext}</Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={{ paddingBottom: 24 }}>
          <GreenBtn label={t.setupChild} onPress={onNext} />
        </View>
      </SafeAreaView>
    </BgImage>
  );
}
const s11 = StyleSheet.create({
  backBtn: { position: 'absolute', top: 54, left: 20, zIndex: 10, padding: 8 },
  backText: { fontSize: 17, fontWeight: '600', color: DARK },
  appsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  appCol: { alignItems: 'center', gap: 4 },
  appName: { fontSize: 14, fontWeight: '700', color: DARK },
  appRole: { fontSize: 12, color: GRAY },
  plus: { fontSize: 24, fontWeight: '600', color: GRAY, marginTop: -20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDone: { width: 28, height: 28, borderRadius: 14, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center' },
  stepPending: { width: 28, height: 28, borderRadius: 14, backgroundColor: LIGHT_GRAY },
  stepLine: { width: 2, height: 24, backgroundColor: GREEN, marginLeft: 13 },
  stepText: { fontSize: 15, fontWeight: '600', color: DARK, flex: 1 },
});

// --- SLIDE 12 - Send Link (with expo-sharing) ---

function Slide12({ t, inviteCode, onOther, onBack }: { t: T; inviteCode: string | null; onOther: () => void; onBack: () => void }) {
  async function handleSendLink() {
    const rawCode = inviteCode?.replace('-', '') ?? '';
    const message = `${t.sendLinkDesc}\nhttps://kakai.kz/join?code=${rawCode}`;
    try {
      await Share.share({ message });
    } catch {}
  }

  return (
    <BgImage source={IMAGES.bgLight}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={s12.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={s12.backText}>{'\u2190'} {t.back}</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, justifyContent: 'center', paddingTop: 40 }}>
          <View style={{ paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: DARK, lineHeight: 28 }}>
              {t.sendLinkTitle}
            </Text>
          </View>

          <View style={{ marginTop: 20, marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
            <Image source={IMAGES.childIcon} style={{ width: 48, height: 48, borderRadius: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: DARK }}>Kakai Bala by Kakai</Text>
              <Text style={{ fontSize: 13, color: GRAY, lineHeight: 18, marginTop: 4 }}>{t.sendLinkDesc}</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingBottom: 8 }}>
          <GreenBtn label={t.sendLink} onPress={handleSendLink} disabled={!inviteCode} />
        </View>
        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 16 }} onPress={onOther} activeOpacity={0.7}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: GREEN }}>{t.otherMethod}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </BgImage>
  );
}
const s12 = StyleSheet.create({
  backBtn: { position: 'absolute', top: 54, left: 20, zIndex: 10, padding: 8 },
  backText: { fontSize: 17, fontWeight: '600', color: GREEN },
});

// --- Shared styles for slides 0-6 ---

const slide = StyleSheet.create({
  bottomCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: DARK,
    textAlign: 'center',
    lineHeight: 32,
  },
});

// --- SLIDE 13 - Waiting for child (invite code, Realtime in parent) ---

function Slide13({ t, inviteCode, onBack, onHelp }: { t: T; inviteCode: string | null; onBack: () => void; onHelp: () => void }) {
  return (
    <BgImage source={IMAGES.bgLight}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={{ position: 'absolute', top: 54, left: 20, zIndex: 10, padding: 8 }} onPress={onBack} activeOpacity={0.7}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: GREEN }}>{'\u2190'} {t.back}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
          <Card>
            <Text style={{ fontSize: 18, fontWeight: '700', color: DARK, textAlign: 'center', lineHeight: 26 }}>
              {t.waitingTitle}
            </Text>
            <View style={{ backgroundColor: '#F3F4F6', borderRadius: 16, paddingVertical: 20, marginTop: 20, alignItems: 'center' }}>
              {inviteCode ? (
                <Text style={{ fontSize: 36, fontWeight: '900', color: GREEN, letterSpacing: 4 }}>
                  {inviteCode}
                </Text>
              ) : (
                <ActivityIndicator size="large" color={GREEN} />
              )}
            </View>
            <Text style={{ fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 20, marginTop: 16 }}>
              {t.waitingHint}
            </Text>
          </Card>
        </View>
        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 20 }} onPress={onHelp} activeOpacity={0.7}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: GRAY }}>{t.needHelp}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </BgImage>
  );
}

// --- SLIDE 14 - Waiting for child setup ---

function Slide14({ t, onContinue, onHelp }: { t: T; onContinue: () => void; onHelp: () => void }) {
  return (
    <ImageBackground source={IMAGES.waitingSetup} resizeMode="cover" style={{ flex: 1, width: '100%', height: '100%' }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }} />
      <View style={s14.overlay}>
        <Text style={s14.title}>{t.waitingSetupTitle}</Text>
        <Text style={s14.desc}>{t.waitingSetupDesc}</Text>
      </View>
      <View style={s14.bottom}>
        <GreenBtn label={t.childReady} onPress={onContinue} />
        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 16 }} onPress={onHelp} activeOpacity={0.7}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>{t.getHelp}</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}
const s14 = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 140, left: 0, right: 0, paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 32 },
  desc: { fontSize: 16, color: '#fff', opacity: 0.8, textAlign: 'center', marginTop: 8 },
  bottom: { position: 'absolute', bottom: 40, left: 0, right: 0 },
});

// --- MAIN ---

export default function OnboardingIndex() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [lang, setLang] = useState<Lang>('ru');
  const [surveySource, setSurveySource] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'parent' | 'child' | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);

  const [authLoading, setAuthLoading] = useState(false);

  const t = translations[lang];
  const go = (n: number) => setI(n);
  const next = () => setI((p) => Math.min(p + 1, SLIDE_COUNT - 1));

  function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: INVITE_CODE_LENGTH }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }

  function showError(msg: string) {
    console.error('[Onboarding]', msg);
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('Error', msg);
    }
  }

  // Called when user selects "Parent" role and taps Continue on slide 10
  async function handleRoleNext() {
    console.log('[Onboarding] handleRoleNext called, role:', selectedRole);
    if (selectedRole !== 'parent') { next(); return; }

    // Check if already authenticated (e.g. user went back and forward)
    const { data: { session: existing } } = await supabase.auth.getSession();
    console.log('[Onboarding] existing session:', !!existing);
    if (existing) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', existing.user.id)
        .maybeSingle();
      if (existingUser?.family_id) {
        setFamilyId(existingUser.family_id);
        next();
        return;
      }
    }

    setAuthLoading(true);
    try {
      // 1. Anonymous Auth
      console.log('[Onboarding] calling signInAnonymously...');
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError || !authData.user) {
        showError(authError?.message ?? 'Auth failed');
        return;
      }
      console.log('[Onboarding] auth success, uid:', authData.user.id);

      // 2. Create user record
      const { error: userError } = await supabase.from('users').insert({
        id: authData.user.id,
        role: 'parent',
        name: '',
        lang: (lang === 'en' ? 'ru' : lang) as 'ru' | 'kz',
      });
      if (userError) {
        showError('User: ' + userError.message);
        return;
      }

      // 3. Create family with invite code
      const code = generateInviteCode();
      const { data: family, error: familyError } = await supabase
        .from('families')
        .insert({ name: '', invite_code: code, parent_id: authData.user.id, status: 'pending' })
        .select('id')
        .single();
      if (familyError || !family) {
        showError('Family: ' + (familyError?.message ?? 'creation failed'));
        return;
      }
      console.log('[Onboarding] family created, code:', code);

      // 4. Link user to family
      await supabase.from('users').update({ family_id: family.id }).eq('id', authData.user.id);

      // 5. Set state so slides 12/13 have invite code
      setFamilyId(family.id);
      setInviteCode(code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code);
      next();
    } catch (err) {
      console.error('[Onboarding] unexpected error:', err);
      showError(String(err));
    } finally {
      setAuthLoading(false);
    }
  }

  // Load invite code on mount if session already exists (e.g. app restart mid-onboarding)
  useEffect(() => {
    async function loadInviteCode() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: user } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!user?.family_id) return;
      setFamilyId(user.family_id);

      const { data: family } = await supabase
        .from('families')
        .select('invite_code')
        .eq('id', user.family_id)
        .maybeSingle();

      if (family?.invite_code) {
        const code = family.invite_code;
        setInviteCode(code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code);
      }
    }

    loadInviteCode();
  }, []);

  // Realtime: listen for child connecting (works on slides 12 & 13)
  useEffect(() => {
    if (!familyId) return;

    const channel = supabase
      .channel(`family-${familyId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'families',
        filter: `id=eq.${familyId}`,
      }, (payload) => {
        if (payload.new && (payload.new as Record<string, unknown>).child_id) {
          setI(14);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [familyId]);

  const showSkip = i >= 1 && i <= 5;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="dark-content" />

      {showSkip && (
        <TouchableOpacity style={root.skip} onPress={() => go(7)} activeOpacity={0.7}>
          <Text style={root.skipText}>{t.skip}</Text>
        </TouchableOpacity>
      )}

      {i === 0 && <Slide0 t={t} lang={lang} setLang={setLang} onNext={next} />}
      {i === 1 && <FeatureSlide t={t} imageSource={IMAGES.block} title={t.blockTitle} dotIndex={1} onNext={next} />}
      {i === 2 && <FeatureSlide t={t} imageSource={IMAGES.sleep} title={t.sleepTitle} dotIndex={2} onNext={next} />}
      {i === 3 && <FeatureSlide t={t} imageSource={IMAGES.youtube} title={t.youtubeTitle} dotIndex={3} onNext={next} />}
      {i === 4 && <FeatureSlide t={t} imageSource={IMAGES.limit} title={t.limitTitle} dotIndex={4} onNext={next} />}
      {i === 5 && <FeatureSlide t={t} imageSource={IMAGES.tasks} title={t.tasksTitle} dotIndex={5} onNext={next} />}
      {i === 6 && <Slide6 t={t} onNext={next} />}
      {i === 7 && <Slide7 t={t} onSelect={(v) => { setSurveySource(v); next(); }} onSkip={next} />}
      {i === 8 && <Slide8 t={t} onNext={next} />}
      {i === 9 && <Slide9 t={t} onAllow={next} onLater={next} />}
      {i === 10 && <Slide10 t={t} role={selectedRole} setRole={setSelectedRole} onNext={handleRoleNext} loading={authLoading} />}
      {i === 11 && <Slide11 t={t} onNext={next} onBack={() => go(10)} />}
      {i === 12 && <Slide12 t={t} inviteCode={inviteCode} onOther={() => go(13)} onBack={() => go(11)} />}
      {i === 13 && <Slide13 t={t} inviteCode={inviteCode} onBack={() => go(12)} onHelp={() => Alert.alert(t.getHelp, t.helpInstructions)} />}
      {i === 14 && <Slide14 t={t} onContinue={() => router.push('/(onboarding)/quiz')} onHelp={() => Alert.alert(t.getHelp, t.helpInstructions)} />}
    </View>
  );
}

const root = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  skip: { position: 'absolute', top: 54, right: 20, zIndex: 10, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16 },
  skipText: { fontSize: 15, fontWeight: '600', color: GRAY },
});
