import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Dimensions, ScrollView, StatusBar, Animated, Easing, Linking, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W } = Dimensions.get('window');
const GREEN = '#2DB573';
const DARK = '#1A1A2E';
const BG = '#F5F5F7';
const GRAY = '#6B7280';
const STEP_COUNT = 18;

const IMAGES = {
  mascotClean: require('../../assets/giraffe_mascot_clean.png'),
  tasks: require('../../assets/giraffe_tasks.png'),
  block: require('../../assets/giraffe_block.png'),
  gps: require('../../assets/giraffe_gps.png'),
  sleep: require('../../assets/giraffe_sleep.png'),
};

// ─── Translations ───

type Lang = 'kz' | 'ru' | 'en';

const translations = {
  ru: {
    skip: 'Пропустить',
    continue: 'Продолжить',
    yes: 'Да',
    no: 'Нет',
    // Step 0
    s0Title: 'Настройка телефона ребёнка завершена!',
    s0Sub: 'Давайте познакомимся с Kakai',
    // Step 1
    s1Title: 'Для чего вы хотите использовать Kakai?',
    s1Opt1: 'Контроль экранного времени',
    s1Opt2: 'Помощь с учёбой',
    s1Opt3: 'Защита от онлайн-угроз',
    s1Opt4: 'Режим сна',
    s1Opt5: 'Снижение раздражительности',
    s1Opt6: 'GPS-местоположение',
    // Step 2
    s2Title: 'Супер! Вместе с Kakai вы сможете:',
    s2g1: 'Устанавливать лимиты и контролировать экранное время',
    s2g2: 'Мотивировать ребёнка через задания и награды',
    s2g3: 'Блокировать нежелательный контент и сайты',
    s2g4: 'Ограничивать телефон во время сна',
    s2g5: 'Помогать ребёнку регулировать эмоции',
    s2g6: 'Отслеживать местоположение ребёнка',
    // Step 3
    s3Q: (n: string) => `Знаете ли вы сколько времени ${n} проводит в телефоне?`,
    s3Yes: 'Отлично! С Kakai вы сможете видеть как меняются привычки ребёнка со временем',
    s3No: 'Не переживайте 🙂 Kakai покажет экранное время ребёнка и самые используемые приложения',
    // Step 4
    s4Title: (n: string) => `Приложения которыми ${n} пользуется больше всего`,
    s4Empty: 'Данные появятся после первого дня использования',
    // Step 5
    s5Title: 'С Kakai дети учатся ответственности',
    s5Desc: 'Дети выполняют задания от родителей и зарабатывают экранное время своим трудом. Полезные привычки вместо бесконтрольного использования телефона',
    // Step 6
    s6Q: (n: string) => `Бывают ли ситуации когда вам нужно заблокировать телефон ${n}?`,
    s6Yes: 'Такое случается у многих родителей: детям сложно вовремя остановиться. С Kakai вы легко поможете ребёнку переключиться на отдых или учёбу',
    s6No: 'Это замечательно! Функция блокировки всегда будет доступна если когда-нибудь потребуется',
    // Step 7
    s7Title: 'Заблокируйте игры и видео одной кнопкой',
    s7Desc: 'Чтобы ребёнок смог сосредоточиться на учёбе или отдыхе',
    // Step 8
    s8Q: (n: string) => `Проявляет ли ${n} раздражительность или агрессию?`,
    s8Sub: 'При использовании телефона или когда нужно сделать перерыв',
    s8Yes: 'Это нормально — детям трудно расставаться с телефоном. Kakai помогает сделать этот момент спокойнее и без споров',
    s8No: '73% родителей сталкиваются с этим. Если у вас всё хорошо — Kakai поможет сохранить этот баланс',
    // Step 9
    s9Title: 'Что говорят родители',
    s9r1: 'Дочка стала более открытой и живой в общении. Рекомендую!',
    s9a1: 'Айгуль',
    s9r2: 'Наконец-то сын сам откладывает телефон. Решение найдено!',
    s9a2: 'Бауыржан',
    s9r3: 'Нашла общий язык с ребёнком. Мои нервы благодарны 🙏',
    s9a3: 'Динара',
    s9r4: 'На каникулах Kakai просто спасение! Дети проводят больше времени с семьёй',
    s9a4: 'Мадина',
    // Step 10
    s10Q: (n: string) => `Беспокоитесь ли вы когда ${n} не с вами?`,
    s10Sub: 'Например, когда гуляет один или идёт в школу',
    s10Yes: 'Это чувство знакомо каждому родителю. С Kakai вы всегда можете убедиться что с ребёнком всё в порядке',
    s10No: 'Отлично, значит всё под контролем! Если что, вы всегда можете положиться на Kakai',
    // Step 11
    s11Title: (n: string) => `С Kakai вы всегда знаете где находится ${n}`,
    s11Empty: 'GPS данные появятся после включения',
    s11Open: 'Открыть в картах',
    // Step 12
    s12Q: (n: string) => `Беспокоитесь ли вы что ${n} играет в телефон во время сна или учёбы?`,
    s12Yes: 'Это серьёзная проблема! Гаджеты перед сном негативно влияют на сон из-за синего света. Kakai поможет ребёнку наладить режим',
    s12No: 'Отлично, если режим уже налажен! Kakai поможет его сохранить',
    // Step 13
    s13Title: 'Ограничьте использование телефона на время сна и учёбы',
    s13School: 'Школа',
    s13Sleep: 'Сон',
    // Step 14
    s14Q: (n: string) => `Беспокоитесь ли вы за сайты которые посещает ${n}?`,
    s14Yes: 'Это естественно — 85% родителей волнуются что ребёнок может попасть на нежелательный сайт. С Kakai вы будете спокойнее',
    s14No: 'Здорово если вы уверены! Но Kakai всегда поможет проверить что ребёнок видит только безопасный контент',
    // Step 15
    s15Title: 'Следите за безопасностью в интернете',
    s15Blocked: 'Заблокировано',
    s15Allowed: 'Разрешено',
    // Step 16
    s16Without: 'Без Kakai',
    s16With: 'С Kakai',
    s16w1: 'Не знаете сколько ребёнок в телефоне',
    s16w2: 'Споры из-за экранного времени',
    s16w3: 'Тревога за безопасность в интернете',
    s16w4: 'Нет контроля во время сна и учёбы',
    s16k1: 'Полная статистика экранного времени',
    s16k2: 'Автоматические лимиты без споров',
    s16k3: 'Фильтрация контента и сайтов',
    s16k4: 'Расписание блокировок',
    s16k5: 'GPS и задания для ребёнка',
    s16Join: 'Присоединяйтесь',
    // Step 17
    s17Title: 'Настраиваем Kakai для вас...',
  },
  kz: {
    skip: 'Өткізу',
    continue: 'Жалғастыру',
    yes: 'Иә',
    no: 'Жоқ',
    s0Title: 'Бала телефонының баптауы аяқталды!',
    s0Sub: 'Kakai-мен танысайық',
    s1Title: 'Kakai-ді не үшін пайдаланғыңыз келеді?',
    s1Opt1: 'Экран уақытын бақылау',
    s1Opt2: 'Оқуға көмек',
    s1Opt3: 'Онлайн қауіптерден қорғау',
    s1Opt4: 'Ұйқы режимі',
    s1Opt5: 'Тітіркенуді азайту',
    s1Opt6: 'GPS-орналасу',
    s2Title: 'Тамаша! Kakai-мен бірге сіз:',
    s2g1: 'Лимиттер орнатып, экран уақытын бақылай аласыз',
    s2g2: 'Баланы тапсырмалар мен сыйлықтар арқылы ынталандыра аласыз',
    s2g3: 'Қажетсіз контент пен сайттарды бұғаттай аласыз',
    s2g4: 'Ұйқы уақытында телефонды шектей аласыз',
    s2g5: 'Балаға эмоцияларын реттеуге көмектесе аласыз',
    s2g6: 'Баланың орналасуын қадағалай аласыз',
    s3Q: (n: string) => `${n} телефонда қанша уақыт өткізетінін білесіз бе?`,
    s3Yes: 'Тамаша! Kakai-мен баланың әдеттері уақыт өте қалай өзгеретінін көре аласыз',
    s3No: 'Уайымдамаңыз 🙂 Kakai баланың экран уақытын және ең көп қолданылатын қосымшаларды көрсетеді',
    s4Title: (n: string) => `${n} ең көп пайдаланатын қосымшалар`,
    s4Empty: 'Деректер пайдаланудың бірінші күнінен кейін пайда болады',
    s5Title: 'Kakai-мен балалар жауапкершілікке үйренеді',
    s5Desc: 'Балалар ата-аналардан тапсырмалар орындап, экран уақытын өз еңбегімен табады. Бақылаусыз пайдаланудың орнына пайдалы әдеттер',
    s6Q: (n: string) => `${n} телефонын бұғаттау керек болатын жағдайлар бола ма?`,
    s6Yes: 'Бұл көптеген ата-аналарда кездеседі: балаларға уақытында тоқтау қиын. Kakai-мен балаға демалысқа немесе оқуға ауысуға оңай көмектесесіз',
    s6No: 'Бұл керемет! Бұғаттау функциясы қажет болған кезде әрқашан қолжетімді',
    s7Title: 'Ойындар мен бейнелерді бір басумен бұғаттаңыз',
    s7Desc: 'Бала оқуға немесе демалысқа назар аудара алуы үшін',
    s8Q: (n: string) => `${n} тітіркенушілік немесе агрессия көрсете ме?`,
    s8Sub: 'Телефон пайдаланған кезде немесе үзіліс жасау керек болғанда',
    s8Yes: 'Бұл қалыпты — балаларға телефоннан айырылу қиын. Kakai бұл сәтті тыныш және дауысыз етуге көмектеседі',
    s8No: 'Ата-аналардың 73% осыған тап болады. Бәрі жақсы болса — Kakai бұл тепе-теңдікті сақтауға көмектеседі',
    s9Title: 'Ата-аналар не дейді',
    s9r1: 'Қызым қарым-қатынаста ашық және жанды болды. Ұсынамын!',
    s9a1: 'Айгүл',
    s9r2: 'Ақырында ұлым телефонды өзі қояды. Шешім табылды!',
    s9a2: 'Бауыржан',
    s9r3: 'Баламен ортақ тіл таптым. Жүйкелерім ризалығын білдіреді 🙏',
    s9a3: 'Динара',
    s9r4: 'Демалыста Kakai жай ғана құтқарушы! Балалар отбасымен көбірек уақыт өткізеді',
    s9a4: 'Мадина',
    s10Q: (n: string) => `${n} сізбен бірге болмағанда уайымдайсыз ба?`,
    s10Sub: 'Мысалы, жалғыз серуендегенде немесе мектепке барғанда',
    s10Yes: 'Бұл сезім әр ата-анаға таныс. Kakai-мен баламен бәрі жақсы екеніне әрқашан көз жеткізе аласыз',
    s10No: 'Тамаша, бәрі бақылауда! Қажет болса, Kakai-ге әрқашан сене аласыз',
    s11Title: (n: string) => `Kakai-мен ${n} қайда екенін әрқашан білесіз`,
    s11Empty: 'GPS деректері қосқаннан кейін пайда болады',
    s11Open: 'Картада ашу',
    s12Q: (n: string) => `${n} ұйқы немесе оқу уақытында телефонмен ойнайтынына уайымдайсыз ба?`,
    s12Yes: 'Бұл маңызды мәселе! Ұйқы алдындағы гаджеттер көк жарық салдарынан ұйқыға теріс әсер етеді. Kakai балаға режимді реттеуге көмектеседі',
    s12No: 'Режим реттелген болса тамаша! Kakai оны сақтауға көмектеседі',
    s13Title: 'Ұйқы мен оқу уақытында телефон пайдалануды шектеңіз',
    s13School: 'Мектеп',
    s13Sleep: 'Ұйқы',
    s14Q: (n: string) => `${n} кіретін сайттар туралы уайымдайсыз ба?`,
    s14Yes: 'Бұл табиғи — ата-аналардың 85% бала қажетсіз сайтқа түсіп кетуінен алаңдайды. Kakai-мен тыныш боласыз',
    s14No: 'Сенімді болсаңыз тамаша! Бірақ Kakai бала тек қауіпсіз контентті көретінін тексеруге әрқашан көмектеседі',
    s15Title: 'Интернеттегі қауіпсіздікті бақылаңыз',
    s15Blocked: 'Бұғатталған',
    s15Allowed: 'Рұқсат етілген',
    s16Without: 'Kakai-сіз',
    s16With: 'Kakai-мен',
    s16w1: 'Бала телефонда қанша уақыт екенін білмейсіз',
    s16w2: 'Экран уақытына байланысты дау',
    s16w3: 'Интернеттегі қауіпсіздікке алаңдау',
    s16w4: 'Ұйқы мен оқу кезінде бақылау жоқ',
    s16k1: 'Экран уақытының толық статистикасы',
    s16k2: 'Даусыз автоматты лимиттер',
    s16k3: 'Контент пен сайттарды сүзу',
    s16k4: 'Бұғаттау кестесі',
    s16k5: 'GPS және бала тапсырмалары',
    s16Join: 'Қосылыңыз',
    s17Title: 'Kakai-ді сіз үшін баптаудамыз...',
  },
  en: {
    skip: 'Skip',
    continue: 'Continue',
    yes: 'Yes',
    no: 'No',
    s0Title: 'Child phone setup complete!',
    s0Sub: "Let's get to know Kakai",
    s1Title: 'What do you want to use Kakai for?',
    s1Opt1: 'Screen time control',
    s1Opt2: 'Help with learning',
    s1Opt3: 'Online threat protection',
    s1Opt4: 'Sleep mode',
    s1Opt5: 'Reduce irritability',
    s1Opt6: 'GPS location',
    s2Title: 'Great! With Kakai you can:',
    s2g1: 'Set limits and control screen time',
    s2g2: 'Motivate your child with tasks and rewards',
    s2g3: 'Block unwanted content and websites',
    s2g4: 'Restrict the phone during sleep time',
    s2g5: 'Help your child regulate emotions',
    s2g6: "Track your child's location",
    s3Q: (n: string) => `Do you know how much time ${n} spends on the phone?`,
    s3Yes: "Great! With Kakai you'll see how your child's habits change over time",
    s3No: "Don't worry 🙂 Kakai will show your child's screen time and most used apps",
    s4Title: (n: string) => `Apps ${n} uses the most`,
    s4Empty: 'Data will appear after the first day of use',
    s5Title: 'With Kakai kids learn responsibility',
    s5Desc: "Kids complete tasks from parents and earn screen time through their own effort. Healthy habits instead of uncontrolled phone use",
    s6Q: (n: string) => `Do you ever need to block ${n}'s phone?`,
    s6Yes: "Many parents face this: it's hard for kids to stop on time. With Kakai you can easily help your child switch to rest or study",
    s6No: "That's wonderful! The blocking feature will always be available if you ever need it",
    s7Title: 'Block games and videos with one tap',
    s7Desc: 'So your child can focus on studying or resting',
    s8Q: (n: string) => `Does ${n} show irritability or aggression?`,
    s8Sub: 'When using the phone or when a break is needed',
    s8Yes: "It's normal — kids find it hard to part with the phone. Kakai helps make this moment calmer and argument-free",
    s8No: '73% of parents face this. If all is well — Kakai will help maintain this balance',
    s9Title: 'What parents say',
    s9r1: 'My daughter became more open and lively. I recommend!',
    s9a1: 'Aigul',
    s9r2: 'Finally my son puts down the phone himself. Solution found!',
    s9a2: 'Bauyrzhan',
    s9r3: 'Found common ground with my child. My nerves are grateful 🙏',
    s9a3: 'Dinara',
    s9r4: 'On vacation Kakai is a lifesaver! Kids spend more time with family',
    s9a4: 'Madina',
    s10Q: (n: string) => `Do you worry when ${n} is not with you?`,
    s10Sub: 'For example, when walking alone or going to school',
    s10Yes: "Every parent knows this feeling. With Kakai you can always make sure your child is okay",
    s10No: "Great, everything is under control! If needed, you can always rely on Kakai",
    s11Title: (n: string) => `With Kakai you always know where ${n} is`,
    s11Empty: 'GPS data will appear after enabling',
    s11Open: 'Open in maps',
    s12Q: (n: string) => `Do you worry that ${n} plays on the phone during sleep or study time?`,
    s12Yes: "This is a serious issue! Gadgets before sleep negatively affect sleep due to blue light. Kakai will help your child establish a routine",
    s12No: "Great if the routine is already set! Kakai will help maintain it",
    s13Title: 'Limit phone use during sleep and study time',
    s13School: 'School',
    s13Sleep: 'Sleep',
    s14Q: (n: string) => `Do you worry about the websites ${n} visits?`,
    s14Yes: "It's natural — 85% of parents worry their child may end up on an unwanted site. With Kakai you'll feel calmer",
    s14No: "Great if you're confident! But Kakai will always help check that your child sees only safe content",
    s15Title: 'Monitor internet safety',
    s15Blocked: 'Blocked',
    s15Allowed: 'Allowed',
    s16Without: 'Without Kakai',
    s16With: 'With Kakai',
    s16w1: "You don't know how long your child is on the phone",
    s16w2: 'Arguments over screen time',
    s16w3: 'Worry about online safety',
    s16w4: 'No control during sleep and study',
    s16k1: 'Full screen time statistics',
    s16k2: 'Automatic limits without arguments',
    s16k3: 'Content and website filtering',
    s16k4: 'Blocking schedules',
    s16k5: 'GPS and tasks for children',
    s16Join: 'Join now',
    s17Title: 'Setting up Kakai for you...',
  },
};

type T = typeof translations['ru'];

// ─── Sub-components ───

function ProgressBar({ step }: { step: number }) {
  const pct = ((step + 1) / STEP_COUNT) * 100;
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct}%` }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginHorizontal: 24, marginTop: 12 },
  fill: { height: 4, backgroundColor: GREEN, borderRadius: 2 },
});

function GreenBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[btn.wrap, disabled && btn.disabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text style={btn.text}>{label}</Text>
    </TouchableOpacity>
  );
}
const btn = StyleSheet.create({
  wrap: {
    backgroundColor: GREEN, borderRadius: 16, paddingVertical: 18,
    marginHorizontal: 24, alignItems: 'center', marginBottom: 16,
  },
  disabled: { opacity: 0.5 },
  text: { color: '#fff', fontSize: 17, fontWeight: '800' },
});

function Card({ children }: { children: React.ReactNode }) {
  return <View style={card.wrap}>{children}</View>;
}
const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    marginHorizontal: 24, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
});

function YesNoButtons({
  t, answer, onAnswer,
}: { t: T; answer: boolean | null; onAnswer: (v: boolean) => void }) {
  return (
    <View style={yn.row}>
      <TouchableOpacity
        style={[yn.btn, answer === true && yn.btnActive]}
        onPress={() => onAnswer(true)}
        activeOpacity={0.8}
      >
        <Text style={[yn.btnText, answer === true && yn.btnTextActive]}>{t.yes}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[yn.btn, answer === false && yn.btnActive]}
        onPress={() => onAnswer(false)}
        activeOpacity={0.8}
      >
        <Text style={[yn.btnText, answer === false && yn.btnTextActive]}>{t.no}</Text>
      </TouchableOpacity>
    </View>
  );
}
const yn = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB',
  },
  btnActive: { backgroundColor: '#E6F9F0', borderColor: GREEN },
  btnText: { fontSize: 17, fontWeight: '700', color: DARK },
  btnTextActive: { color: GREEN },
});

// ─── Main component ───

export default function QuizScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<Lang>('ru');
  const [childName, setChildName] = useState('');
  const [goals, setGoals] = useState<number[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, boolean | null>>({});
  const [usageApps, setUsageApps] = useState<{ app_name: string; minutes: number }[]>([]);
  const [gpsPoint, setGpsPoint] = useState<{ lat: number; lng: number } | null>(null);

  // Animated progress for step 17
  const loadingAnim = useRef(new Animated.Value(0)).current;

  const t = translations[lang];
  const name = childName || (lang === 'kz' ? 'бала' : lang === 'en' ? 'child' : 'ребёнок');

  // Load saved language
  useEffect(() => {
    AsyncStorage.getItem('kakai_lang').then((v) => {
      if (v === 'kz' || v === 'ru' || v === 'en') setLang(v);
    });
  }, []);

  // Load child name, usage data, gps
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: user } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!user?.family_id) return;

      const { data: family } = await supabase
        .from('families')
        .select('child_id')
        .eq('id', user.family_id)
        .maybeSingle();
      if (!family?.child_id) return;

      // Child name
      const { data: child } = await supabase
        .from('users')
        .select('name')
        .eq('id', family.child_id)
        .maybeSingle();
      if (child?.name) setChildName(child.name);

      // Usage logs — top apps
      const { data: usage } = await supabase
        .from('usage_logs')
        .select('app_name, minutes')
        .eq('child_id', family.child_id)
        .order('minutes', { ascending: false })
        .limit(5);
      if (usage && usage.length > 0) {
        setUsageApps(usage.map((u) => ({ app_name: u.app_name ?? 'App', minutes: u.minutes })));
      }

      // GPS — latest point
      const { data: gps } = await supabase
        .from('gps_locations')
        .select('lat, lng')
        .eq('child_id', family.child_id)
        .order('recorded_at', { ascending: false })
        .limit(1);
      if (gps && gps.length > 0) {
        setGpsPoint({ lat: gps[0].lat, lng: gps[0].lng });
      }
    }
    load();
  }, []);

  const goNext = () => {
    if (step === STEP_COUNT - 1) return;
    setStep((s) => s + 1);
  };

  const toggleGoal = (idx: number) => {
    setGoals((g) => g.includes(idx) ? g.filter((x) => x !== idx) : [...g, idx]);
  };

  const setAnswer = (s: number, v: boolean) => {
    setQuizAnswers((a) => ({ ...a, [s]: v }));
  };

  // Step 17 loading animation
  useEffect(() => {
    if (step === 17) {
      loadingAnim.setValue(0);
      Animated.timing(loadingAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        router.replace('/(onboarding)/paywall');
      });
    }
  }, [step]);

  const openMaps = (lat: number, lng: number) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}`,
      default: `geo:${lat},${lng}?q=${lat},${lng}`,
    });
    Linking.openURL(url);
  };

  // ─── Render each step ───

  function renderStep() {
    switch (step) {
      // ── Step 0: Success ──
      case 0:
        return (
          <View style={s.centered}>
            <Image source={IMAGES.mascotClean} style={s.heroImg} resizeMode="contain" />
            <Text style={s.title}>{t.s0Title}</Text>
            <Text style={s.subtitle}>{t.s0Sub}</Text>
            <View style={s.spacer} />
            <GreenBtn label={t.continue} onPress={goNext} />
          </View>
        );

      // ── Step 1: Multi-select goals ──
      case 1: {
        const opts = [t.s1Opt1, t.s1Opt2, t.s1Opt3, t.s1Opt4, t.s1Opt5, t.s1Opt6];
        const icons = ['⏱', '📚', '🛡', '🌙', '😤', '📍'];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.title}>{t.s1Title}</Text>
            <View style={s.gap12}>
              {opts.map((opt, idx) => {
                const sel = goals.includes(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[s.goalCard, sel && s.goalCardActive]}
                    onPress={() => toggleGoal(idx)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.goalIcon}>{icons[idx]}</Text>
                    <Text style={[s.goalText, sel && s.goalTextActive]}>{opt}</Text>
                    <View style={[s.checkbox, sel && s.checkboxActive]}>
                      {sel && <Text style={s.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ height: 16 }} />
            <GreenBtn label={t.continue} onPress={goNext} disabled={goals.length === 0} />
          </ScrollView>
        );
      }

      // ── Step 2: Personalized results ──
      case 2: {
        const allResults = [t.s2g1, t.s2g2, t.s2g3, t.s2g4, t.s2g5, t.s2g6];
        const shown = goals.length > 0 ? goals.map((i) => allResults[i]) : allResults;
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.title}>{t.s2Title}</Text>
            <Card>
              {shown.map((item, idx) => (
                <View key={idx} style={s.checkRow}>
                  <Text style={s.greenCheck}>✓</Text>
                  <Text style={s.checkText}>{item}</Text>
                </View>
              ))}
            </Card>
            <GreenBtn label={t.continue} onPress={goNext} />
          </ScrollView>
        );
      }

      // ── Step 3: Quiz — screen time ──
      case 3:
        return renderQuizStep(3, t.s3Q(name), undefined, t.s3Yes, t.s3No);

      // ── Step 4: Feature — usage stats ──
      case 4:
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.title}>{t.s4Title(name)}</Text>
            <Card>
              {usageApps.length > 0 ? (
                usageApps.map((app, idx) => (
                  <View key={idx} style={s.usageRow}>
                    <View style={s.usageIcon}>
                      <Text style={{ fontSize: 20 }}>📱</Text>
                    </View>
                    <Text style={s.usageName}>{app.app_name}</Text>
                    <Text style={s.usageTime}>{app.minutes} мин</Text>
                  </View>
                ))
              ) : (
                <View style={s.emptyBox}>
                  <Text style={s.emptyIcon}>📊</Text>
                  <Text style={s.emptyText}>{t.s4Empty}</Text>
                </View>
              )}
            </Card>
            <GreenBtn label={t.continue} onPress={goNext} />
          </ScrollView>
        );

      // ── Step 5: Feature — tasks ──
      case 5:
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Image source={IMAGES.tasks} style={s.featureImg} resizeMode="contain" />
            <Text style={s.title}>{t.s5Title}</Text>
            <Text style={s.desc}>{t.s5Desc}</Text>
            <View style={s.spacer} />
            <GreenBtn label={t.continue} onPress={goNext} />
          </ScrollView>
        );

      // ── Step 6: Quiz — blocking ──
      case 6:
        return renderQuizStep(6, t.s6Q(name), undefined, t.s6Yes, t.s6No);

      // ── Step 7: Feature — blocking ──
      case 7:
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Image source={IMAGES.block} style={s.featureImg} resizeMode="contain" />
            <Text style={s.title}>{t.s7Title}</Text>
            <Text style={s.desc}>{t.s7Desc}</Text>
            <View style={s.spacer} />
            <GreenBtn label={t.continue} onPress={goNext} />
          </ScrollView>
        );

      // ── Step 8: Quiz — irritability ──
      case 8:
        return renderQuizStep(8, t.s8Q(name), t.s8Sub, t.s8Yes, t.s8No);

      // ── Step 9: Social proof ──
      case 9: {
        const reviews = [
          { text: t.s9r1, author: t.s9a1 },
          { text: t.s9r2, author: t.s9a2 },
          { text: t.s9r3, author: t.s9a3 },
          { text: t.s9r4, author: t.s9a4 },
        ];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.title}>{t.s9Title}</Text>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Text key={i} style={s.star}>★</Text>
              ))}
            </View>
            {reviews.map((r, idx) => (
              <Card key={idx}>
                <Text style={s.reviewText}>"{r.text}"</Text>
                <Text style={s.reviewAuthor}>— {r.author}</Text>
              </Card>
            ))}
            <GreenBtn label={t.continue} onPress={goNext} />
          </ScrollView>
        );
      }

      // ── Step 10: Quiz — worry ──
      case 10:
        return renderQuizStep(10, t.s10Q(name), t.s10Sub, t.s10Yes, t.s10No);

      // ── Step 11: Feature — GPS ──
      case 11:
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Image source={IMAGES.gps} style={s.featureImg} resizeMode="contain" />
            <Text style={s.title}>{t.s11Title(name)}</Text>
            <Card>
              {gpsPoint ? (
                <View>
                  <View style={s.gpsCoords}>
                    <Text style={s.gpsIcon}>📍</Text>
                    <Text style={s.gpsText}>{gpsPoint.lat.toFixed(4)}, {gpsPoint.lng.toFixed(4)}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.gpsBtn}
                    onPress={() => openMaps(gpsPoint.lat, gpsPoint.lng)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.gpsBtnText}>{t.s11Open}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.emptyBox}>
                  <Text style={s.emptyIcon}>🗺</Text>
                  <Text style={s.emptyText}>{t.s11Empty}</Text>
                </View>
              )}
            </Card>
            <GreenBtn label={t.continue} onPress={goNext} />
          </ScrollView>
        );

      // ── Step 12: Quiz — sleep/study ──
      case 12:
        return renderQuizStep(12, t.s12Q(name), undefined, t.s12Yes, t.s12No);

      // ── Step 13: Feature — schedule ──
      case 13:
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Image source={IMAGES.sleep} style={s.featureImg} resizeMode="contain" />
            <Text style={s.title}>{t.s13Title}</Text>
            <View style={s.gap12}>
              <View style={s.scheduleCard}>
                <Text style={s.schedIcon}>🏫</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.schedLabel}>{t.s13School}</Text>
                  <Text style={s.schedTime}>08:00 – 16:00</Text>
                  <Text style={s.schedDays}>{lang === 'kz' ? 'Дс – Жм' : lang === 'en' ? 'Mon – Fri' : 'Пн – Пт'}</Text>
                </View>
                <View style={s.toggleOn}><View style={s.toggleDot} /></View>
              </View>
              <View style={s.scheduleCard}>
                <Text style={s.schedIcon}>🌙</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.schedLabel}>{t.s13Sleep}</Text>
                  <Text style={s.schedTime}>22:00 – 07:00</Text>
                  <Text style={s.schedDays}>{lang === 'kz' ? 'Күнделікті' : lang === 'en' ? 'Every day' : 'Каждый день'}</Text>
                </View>
                <View style={s.toggleOn}><View style={s.toggleDot} /></View>
              </View>
            </View>
            <View style={s.spacer} />
            <GreenBtn label={t.continue} onPress={goNext} />
          </ScrollView>
        );

      // ── Step 14: Quiz — websites ──
      case 14:
        return renderQuizStep(14, t.s14Q(name), undefined, t.s14Yes, t.s14No);

      // ── Step 15: Feature — internet safety ──
      case 15: {
        const blocked = ['casino-online.com', 'adult-content.net', 'violence-games.io'];
        const allowed = ['youtube.com', 'wikipedia.org', 'khan-academy.org'];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.title}>{t.s15Title}</Text>
            <Card>
              <Text style={s.filterLabel}>🔴 {t.s15Blocked}</Text>
              {blocked.map((site) => (
                <View key={site} style={s.siteRow}>
                  <Text style={s.siteBlocked}>✕</Text>
                  <Text style={[s.siteText, { color: '#EF4444' }]}>{site}</Text>
                </View>
              ))}
              <View style={{ height: 16 }} />
              <Text style={s.filterLabel}>🟢 {t.s15Allowed}</Text>
              {allowed.map((site) => (
                <View key={site} style={s.siteRow}>
                  <Text style={s.siteAllowed}>✓</Text>
                  <Text style={[s.siteText, { color: GREEN }]}>{site}</Text>
                </View>
              ))}
            </Card>
            <GreenBtn label={t.continue} onPress={goNext} />
          </ScrollView>
        );
      }

      // ── Step 16: Comparison ──
      case 16:
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {/* Without */}
            <View style={s.compCard}>
              <Text style={s.compTitleBad}>{t.s16Without}</Text>
              {[t.s16w1, t.s16w2, t.s16w3, t.s16w4].map((item, i) => (
                <View key={i} style={s.compRow}>
                  <Text style={s.compMinus}>−</Text>
                  <Text style={s.compTextBad}>{item}</Text>
                </View>
              ))}
            </View>
            {/* With */}
            <View style={s.compCardGood}>
              <Text style={s.compTitleGood}>{t.s16With}</Text>
              {[t.s16k1, t.s16k2, t.s16k3, t.s16k4, t.s16k5].map((item, i) => (
                <View key={i} style={s.compRow}>
                  <Text style={s.compCheck}>✓</Text>
                  <Text style={s.compTextGood}>{item}</Text>
                </View>
              ))}
            </View>
            <GreenBtn label={t.s16Join} onPress={goNext} />
          </ScrollView>
        );

      // ── Step 17: Loading ──
      case 17: {
        const pctText = loadingAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', '100%'],
        });
        const circleProgress = loadingAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        });
        return (
          <View style={s.loadingWrap}>
            <View style={s.loadingCircleOuter}>
              <Animated.View
                style={[s.loadingCircleFill, {
                  transform: [{ rotate: circleProgress }],
                }]}
              />
              <View style={s.loadingCircleInner}>
                <Animated.Text style={s.loadingPct}>{pctText}</Animated.Text>
              </View>
            </View>
            <Text style={s.loadingTitle}>{t.s17Title}</Text>
          </View>
        );
      }

      default:
        return null;
    }
  }

  function renderQuizStep(
    stepNum: number,
    question: string,
    subtext: string | undefined,
    yesEmpathy: string,
    noEmpathy: string,
  ) {
    const answer = quizAnswers[stepNum] ?? null;
    const empathy = answer === true ? yesEmpathy : answer === false ? noEmpathy : null;

    return (
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={s.quizQ}>{question}</Text>
          {subtext && <Text style={s.quizSub}>{subtext}</Text>}
          <YesNoButtons t={t} answer={answer} onAnswer={(v) => setAnswer(stepNum, v)} />
        </Card>
        {empathy && (
          <Card>
            <Text style={s.empathy}>{empathy}</Text>
          </Card>
        )}
        <GreenBtn label={t.continue} onPress={goNext} disabled={answer === null} />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="dark-content" />

      {/* Header: progress + skip */}
      {step < 17 && (
        <View style={s.header}>
          <ProgressBar step={step} />
          <TouchableOpacity
            style={s.skipBtn}
            onPress={() => router.replace('/(onboarding)/paywall')}
            activeOpacity={0.7}
          >
            <Text style={s.skipText}>{t.skip}</Text>
          </TouchableOpacity>
        </View>
      )}

      {renderStep()}
    </View>
  );
}

// ─── Styles ───

const s = StyleSheet.create({
  header: { paddingTop: 50 },
  skipBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16 },
  skipText: { fontSize: 15, fontWeight: '600', color: GRAY },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  scroll: { flexGrow: 1, paddingTop: 70, paddingBottom: 40 },
  spacer: { flex: 1, minHeight: 24 },
  gap12: { gap: 12, marginHorizontal: 24 },

  title: { fontSize: 24, fontWeight: '800', color: DARK, textAlign: 'center', marginBottom: 12, marginHorizontal: 24, lineHeight: 32 },
  subtitle: { fontSize: 16, color: GRAY, textAlign: 'center', marginBottom: 24, marginHorizontal: 24 },
  desc: { fontSize: 15, color: GRAY, textAlign: 'center', lineHeight: 22, marginHorizontal: 24, marginBottom: 24 },

  heroImg: { width: W * 0.5, height: W * 0.5, marginBottom: 24 },
  featureImg: { width: W * 0.6, height: W * 0.45, alignSelf: 'center', marginBottom: 16 },

  // Goals (step 1)
  goalCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#E5E7EB',
  },
  goalCardActive: { borderColor: GREEN, backgroundColor: '#F0FDF4' },
  goalIcon: { fontSize: 24, marginRight: 12 },
  goalText: { flex: 1, fontSize: 15, fontWeight: '600', color: DARK },
  goalTextActive: { color: GREEN },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center',
  },
  checkboxActive: { backgroundColor: GREEN, borderColor: GREEN },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Check list (step 2)
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 10 },
  greenCheck: { fontSize: 18, color: GREEN, fontWeight: '800', marginTop: 1 },
  checkText: { flex: 1, fontSize: 15, color: DARK, lineHeight: 22 },

  // Quiz
  quizQ: { fontSize: 20, fontWeight: '800', color: DARK, textAlign: 'center', lineHeight: 28 },
  quizSub: { fontSize: 14, color: GRAY, textAlign: 'center', marginTop: 8 },
  empathy: { fontSize: 15, color: DARK, lineHeight: 22, textAlign: 'center' },

  // Usage (step 4)
  usageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  usageIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  usageName: { flex: 1, fontSize: 15, fontWeight: '600', color: DARK },
  usageTime: { fontSize: 14, fontWeight: '700', color: GRAY },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: GRAY, textAlign: 'center' },

  // Stars (step 9)
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 4 },
  star: { fontSize: 28, color: '#FBBF24' },

  // Reviews
  reviewText: { fontSize: 15, color: DARK, fontStyle: 'italic', lineHeight: 22, marginBottom: 8 },
  reviewAuthor: { fontSize: 13, fontWeight: '700', color: GRAY },

  // GPS (step 11)
  gpsCoords: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  gpsIcon: { fontSize: 24 },
  gpsText: { fontSize: 16, fontWeight: '600', color: DARK },
  gpsBtn: { backgroundColor: '#F0FDF4', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: GREEN },
  gpsBtnText: { fontSize: 15, fontWeight: '700', color: GREEN },

  // Schedule (step 13)
  scheduleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB',
  },
  schedIcon: { fontSize: 28, marginRight: 12 },
  schedLabel: { fontSize: 16, fontWeight: '700', color: DARK },
  schedTime: { fontSize: 14, fontWeight: '600', color: GREEN, marginTop: 2 },
  schedDays: { fontSize: 12, color: GRAY, marginTop: 2 },
  toggleOn: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: GREEN,
    justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 3,
  },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },

  // Internet filter (step 15)
  filterLabel: { fontSize: 14, fontWeight: '700', color: DARK, marginBottom: 8 },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  siteBlocked: { fontSize: 16, color: '#EF4444', fontWeight: '800' },
  siteAllowed: { fontSize: 16, color: GREEN, fontWeight: '800' },
  siteText: { fontSize: 14, fontWeight: '500' },

  // Comparison (step 16)
  compCard: {
    backgroundColor: '#F3F4F6', borderRadius: 20, padding: 20,
    marginHorizontal: 24, marginBottom: 16,
  },
  compCardGood: {
    backgroundColor: '#F0FDF4', borderRadius: 20, padding: 20,
    marginHorizontal: 24, marginBottom: 24, borderWidth: 2, borderColor: GREEN,
  },
  compTitleBad: { fontSize: 18, fontWeight: '800', color: '#6B7280', marginBottom: 12 },
  compTitleGood: { fontSize: 18, fontWeight: '800', color: GREEN, marginBottom: 12 },
  compRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  compMinus: { fontSize: 18, fontWeight: '800', color: '#9CA3AF', width: 20 },
  compCheck: { fontSize: 18, fontWeight: '800', color: GREEN, width: 20 },
  compTextBad: { flex: 1, fontSize: 14, color: '#6B7280', lineHeight: 20 },
  compTextGood: { flex: 1, fontSize: 14, color: DARK, lineHeight: 20 },

  // Loading (step 17)
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingCircleOuter: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 6, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  loadingCircleFill: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 6, borderColor: GREEN,
    borderTopColor: 'transparent', borderRightColor: 'transparent',
  },
  loadingCircleInner: { justifyContent: 'center', alignItems: 'center' },
  loadingPct: { fontSize: 24, fontWeight: '800', color: DARK },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: DARK, textAlign: 'center' },
});
