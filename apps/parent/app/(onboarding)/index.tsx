import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Dimensions, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const { width: W, height: H } = Dimensions.get('window');
const GREEN = '#2DB573';
const DARK = '#1A1A2E';
const BG = '#F0F2F5';
const GRAY = '#6B7280';
const LIGHT_GRAY = '#E5E7EB';
const YELLOW = '#FEF3C7';
const DOT_COUNT = 7;
const SLIDE_COUNT = 13;

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
};

// ─── Translations ───────────────────────────────────────────────────────────

const translations = {
  kz: {
    // 0
    welcomeTitle: 'Баланың телефонына\nшектеу қойыңыз',
    welcomeSub: '«kakai» — аналар мен әкелер бала зиянды нәрсеге қол созғанда айтады. Телефон — да солай.',
    // 1
    blockTitle: 'Қосымшаларға кіруді\nбір басумен бұғаттаңыз',
    // 2
    sleepTitle: 'Ұйқы мен оқу уақытында\nқосымшаларға кіруді шектеңіз',
    // 3
    youtubeTitle: 'Сайттар мен YouTube\nкіруді бақылаңыз',
    // 4
    limitTitle: 'Күнделікті уақыт шегін\nойын-сауық үшін белгілеңіз',
    // 5
    tasksTitle: 'Күнделікті лимитті пайдалы\nтапсырмалар орындау арқылы\nарттырыңыз',
    // 6
    gpsTitle: 'Бала мектептен шыққанда\nавтоматты хабарлама алыңыз',
    gpsNotif: 'Бала мектептен шықты',
    start: 'Бастау',
    skip: 'Өткізу',
    // 7
    surveyBubble: 'Біз туралы қайдан білдіңіз?',
    surveyOpt1: 'YouTube немесе онлайн-видео',
    surveyOpt2: 'Достар немесе отбасы ұсынысы',
    surveyOpt3: 'Instagram немесе TikTok',
    surveyOpt4: 'Дәрігер немесе маман',
    surveyOpt5: 'App Store / Google Play',
    surveyOpt6: 'Блогер немесе ата-ана форумы',
    surveyOpt7: 'Басқа',
    // 8
    ratingTitle: 'Бағалағаныңыз үшін\nрахмет',
    continue: 'Жалғастыру',
    // 9
    pushTitle: 'Хабарламаларды қосыңыз,\nбаладан хабардар болу үшін',
    allow: 'Рұқсат ету',
    later: 'Кейінірек',
    // 10
    roleTitle: 'Бұл құрылғыны кім пайдаланады?',
    parent: 'Ата-ана',
    parentSub: 'Бұл менің телефоным',
    child: 'Бала',
    childSub: 'Бұл баланың телефоны',
    // 11
    back: 'Артқа',
    kakaiParent: 'Ата-ана үшін',
    kakaiBala: 'Бала үшін',
    stepDone: 'Kakai ата-ана телефонына орнатылды',
    stepNext: 'Баланың телефонын баптайық',
    setupChild: 'Баланың телефонын баптау',
    // 12
    sendLinkTitle: 'Баланың телефонын баптау үшін, оған Kakai Bala қосымшасына сілтеме жіберіңіз',
    sendLinkDesc: 'Kakai Bala қосымшасы баланың деректерін ата-ана қосымшасы Kakai-ге жібереді',
    sendLink: 'Балаға сілтеме жіберу',
    otherMethod: 'Басқа тәсіл',
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
    pushTitle: 'Разрешите уведомления\nчтобы быть в курсе',
    allow: 'Разрешить',
    later: 'Позже',
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
    pushTitle: 'Enable notifications\nto stay informed',
    allow: 'Allow',
    later: 'Later',
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
  },
};

type Lang = keyof typeof translations;
type T = (typeof translations)['ru'];

const LANGS: { key: Lang; label: string }[] = [
  { key: 'kz', label: 'KZ \u049Aa\u0437' },
  { key: 'ru', label: 'RU \u0420\u0443\u0441' },
  { key: 'en', label: 'EN Eng' },
];

// ─── Reusable Components ────────────────────────────────────────────────────

/** Full-screen background image (works on web + native) */
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

const overlay = StyleSheet.create({
  textBox: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: 16, marginHorizontal: 20 },
  title: { fontSize: 26, fontWeight: '800', color: DARK, textAlign: 'center', lineHeight: 34 },
});

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 0 — Welcome
// ═══════════════════════════════════════════════════════════════════════════

function Slide0({ t, lang, setLang, onNext }: { t: T; lang: Lang; setLang: (l: Lang) => void; onNext: () => void }) {
  return (
    <BgImage source={IMAGES.welcome}>
      <View style={{ position: 'absolute', top: 50, alignSelf: 'center', zIndex: 10 }}>
        <LangPicker lang={lang} onChange={setLang} />
      </View>

      <TouchableOpacity style={{ flex: 1, justifyContent: 'flex-end' }} activeOpacity={1} onPress={onNext}>
        <Card>
          <Text style={{ fontSize: 26, fontWeight: '800', color: DARK, textAlign: 'center', lineHeight: 34 }}>
            {t.welcomeTitle}
          </Text>
          <Text style={{ fontSize: 15, color: GRAY, textAlign: 'center', lineHeight: 22, marginTop: 10 }}>
            {t.welcomeSub}
          </Text>
        </Card>

        <Dots count={DOT_COUNT} active={0} />
      </TouchableOpacity>
    </BgImage>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Block Apps
// ═══════════════════════════════════════════════════════════════════════════

function Slide1({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <BgImage source={IMAGES.block}>
      <TouchableOpacity style={{ flex: 1, justifyContent: 'flex-end' }} activeOpacity={1} onPress={onNext}>
        <View style={overlay.textBox}>
          <Text style={overlay.title}>{t.blockTitle}</Text>
        </View>
        <Dots count={DOT_COUNT} active={1} />
      </TouchableOpacity>
    </BgImage>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Sleep
// ═══════════════════════════════════════════════════════════════════════════

function Slide2({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <BgImage source={IMAGES.sleep}>
      <TouchableOpacity style={{ flex: 1, justifyContent: 'flex-end' }} activeOpacity={1} onPress={onNext}>
        <View style={overlay.textBox}>
          <Text style={overlay.title}>{t.sleepTitle}</Text>
        </View>
        <Dots count={DOT_COUNT} active={2} />
      </TouchableOpacity>
    </BgImage>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — YouTube / Sites
// ═══════════════════════════════════════════════════════════════════════════

function Slide3({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <BgImage source={IMAGES.youtube} bgColor="#C8CCD0">
      <TouchableOpacity style={{ flex: 1, justifyContent: 'flex-end' }} activeOpacity={1} onPress={onNext}>
        <View style={overlay.textBox}>
          <Text style={overlay.title}>{t.youtubeTitle}</Text>
        </View>
        <Dots count={DOT_COUNT} active={3} />
      </TouchableOpacity>
    </BgImage>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Daily Limit
// ═══════════════════════════════════════════════════════════════════════════

function Slide4({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <BgImage source={IMAGES.limit}>
      <TouchableOpacity style={{ flex: 1, justifyContent: 'flex-end' }} activeOpacity={1} onPress={onNext}>
        <View style={overlay.textBox}>
          <Text style={overlay.title}>{t.limitTitle}</Text>
        </View>
        <Dots count={DOT_COUNT} active={4} />
      </TouchableOpacity>
    </BgImage>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Tasks
// ═══════════════════════════════════════════════════════════════════════════

function Slide5({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <BgImage source={IMAGES.tasks}>
      <TouchableOpacity style={{ flex: 1, justifyContent: 'flex-end' }} activeOpacity={1} onPress={onNext}>
        <View style={overlay.textBox}>
          <Text style={overlay.title}>{t.tasksTitle}</Text>
        </View>
        <Dots count={DOT_COUNT} active={5} />
      </TouchableOpacity>
    </BgImage>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — GPS
// ═══════════════════════════════════════════════════════════════════════════

function Slide6({ t, onNext }: { t: T; onNext: () => void }) {
  return (
    <BgImage source={IMAGES.gps}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View style={overlay.textBox}>
          <Text style={overlay.title}>{t.gpsTitle}</Text>
        </View>
        <View style={{ paddingTop: 16, paddingBottom: 8 }}>
          <GreenBtn label={t.start} onPress={onNext} />
        </View>
        <Dots count={DOT_COUNT} active={6} />
      </View>
    </BgImage>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Survey
// ═══════════════════════════════════════════════════════════════════════════

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
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <Image source={IMAGES.mascot} style={{ width: 120, height: 120 }} resizeMode="contain" />
            <Bubble text={t.surveyBubble} />
          </View>

          <View style={{ gap: 8, paddingHorizontal: 20, marginTop: 12 }}>
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

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Rating
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Push
// ═══════════════════════════════════════════════════════════════════════════

function Slide9({ t, onAllow, onLater }: { t: T; onAllow: () => void; onLater: () => void }) {
  return (
    <BgImage source={IMAGES.bgLight}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Image source={IMAGES.mascot} style={{ width: 220, height: 220, alignSelf: 'center' }} resizeMode="contain" />
        <Text style={{ fontSize: 22, fontWeight: '800', color: DARK, textAlign: 'center', lineHeight: 30, paddingHorizontal: 24, marginTop: 24 }}>
          {t.pushTitle}
        </Text>
        <View style={{ width: '100%', marginTop: 32, gap: 12 }}>
          <GreenBtn label={t.allow} onPress={onAllow} />
          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={onLater} activeOpacity={0.7}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: GRAY }}>{t.later}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </BgImage>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Role Selection
// ═══════════════════════════════════════════════════════════════════════════

function Slide10({ t, role, setRole, onNext }: { t: T; role: 'parent' | 'child' | null; setRole: (r: 'parent' | 'child') => void; onNext: () => void }) {
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
          <GreenBtn label={t.continue} onPress={onNext} disabled={role === null} />
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

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 11 — Stepper
// ═══════════════════════════════════════════════════════════════════════════

function Slide11({ t, onNext, onBack }: { t: T; onNext: () => void; onBack: () => void }) {
  return (
    <BgImage source={IMAGES.bgLight}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={s11.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={s11.backText}>{'\u2190'} {t.back}</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, justifyContent: 'center', paddingTop: 40 }}>
          <Card style={{ gap: 24 }}>
            {/* App icons */}
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

            {/* Stepper */}
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

        {/* Mascot */}
        <Image source={IMAGES.mascot} style={{ width: 140, height: 140, position: 'absolute', bottom: 100, right: 20 }} resizeMode="contain" />

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

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 12 — Send Link
// ═══════════════════════════════════════════════════════════════════════════

function Slide12({ t, onSend, onOther, onBack }: { t: T; onSend: () => void; onOther: () => void; onBack: () => void }) {
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

        {/* Mascot */}
        <Image source={IMAGES.mascot} style={{ width: 140, height: 140, position: 'absolute', bottom: 140, right: 10 }} resizeMode="contain" />

        <View style={{ paddingBottom: 8 }}>
          <GreenBtn label={t.sendLink} onPress={onSend} />
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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

export default function OnboardingIndex() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [lang, setLang] = useState<Lang>('ru');
  const [surveySource, setSurveySource] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'parent' | 'child' | null>(null);

  const t = translations[lang];
  const go = (n: number) => setI(n);
  const next = () => setI((p) => Math.min(p + 1, SLIDE_COUNT - 1));

  const showSkip = i >= 1 && i <= 6;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="dark-content" />

      {showSkip && (
        <TouchableOpacity style={root.skip} onPress={() => go(7)} activeOpacity={0.7}>
          <Text style={root.skipText}>{t.skip}</Text>
        </TouchableOpacity>
      )}

      {i === 0 && <Slide0 t={t} lang={lang} setLang={setLang} onNext={next} />}
      {i === 1 && <Slide1 t={t} onNext={next} />}
      {i === 2 && <Slide2 t={t} onNext={next} />}
      {i === 3 && <Slide3 t={t} onNext={next} />}
      {i === 4 && <Slide4 t={t} onNext={next} />}
      {i === 5 && <Slide5 t={t} onNext={next} />}
      {i === 6 && <Slide6 t={t} onNext={next} />}
      {i === 7 && <Slide7 t={t} onSelect={(v) => { setSurveySource(v); next(); }} onSkip={next} />}
      {i === 8 && <Slide8 t={t} onNext={next} />}
      {i === 9 && <Slide9 t={t} onAllow={next} onLater={next} />}
      {i === 10 && <Slide10 t={t} role={selectedRole} setRole={setSelectedRole} onNext={next} />}
      {i === 11 && <Slide11 t={t} onNext={next} onBack={() => go(10)} />}
      {i === 12 && <Slide12 t={t} onSend={() => router.replace('/(onboarding)/paywall')} onOther={() => router.replace('/(onboarding)/paywall')} onBack={() => go(11)} />}
    </View>
  );
}

const root = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  skip: { position: 'absolute', top: 54, right: 20, zIndex: 10, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16 },
  skipText: { fontSize: 15, fontWeight: '600', color: GRAY },
});
