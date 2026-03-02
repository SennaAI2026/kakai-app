import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: W } = Dimensions.get('window');
const STEP_COUNT = 10; // steps 0–9; step 9 auto-navigates to paywall

// Which steps are quiz steps (need Yes/No before continuing)
const QUIZ_STEPS = new Set([1, 3, 5, 7]);

// ─── Types ────────────────────────────────────────────────────────────────────

type Answers = Partial<Record<number, boolean>>;

// ─── Shared primitives ────────────────────────────────────────────────────────

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={b.btn} onPress={onPress} activeOpacity={0.85}>
      <Text style={b.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const b = StyleSheet.create({
  btn: { backgroundColor: '#0FA968', borderRadius: 16, padding: 18, alignItems: 'center', marginHorizontal: 24 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '800' },
});

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[p.page, { opacity: fadeAnim }]}>
      <Animated.Text style={[p.welcomeLogo, { transform: [{ scale: scaleAnim }] }]}>🛡️</Animated.Text>
      <Text style={p.welcomeTitle}>Kakai</Text>
      <Text style={p.welcomeSub}>Умный родительский контроль{'\n'}для Казахстана</Text>

      <View style={p.welcomeDots}>
        {['Контроль времени', 'Расписание', 'GPS', 'Задания'].map((item, i) => (
          <View key={i} style={p.welcomeDotRow}>
            <View style={p.welcomeDotDot} />
            <Text style={p.welcomeDotText}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={p.welcomeHint}>Пройдём короткий опрос и настроим{'\n'}Kakai именно под вашу семью</Text>
      <View style={{ height: 32 }} />
      <Btn label="Начать →" onPress={onNext} />
    </Animated.View>
  );
}

// ─── Step 1, 3, 5, 7: Quiz ───────────────────────────────────────────────────

function StepQuiz({
  emoji, question,
  yesLabel, noLabel,
  empathyYes, empathyNo,
  answer, onPick, onNext,
}: {
  emoji: string;
  question: string;
  yesLabel: string;
  noLabel: string;
  empathyYes: string;
  empathyNo: string;
  answer: boolean | undefined;
  onPick: (v: boolean) => void;
  onNext: () => void;
}) {
  const empOpacity = useRef(new Animated.Value(answer !== undefined ? 1 : 0)).current;
  const empY       = useRef(new Animated.Value(answer !== undefined ? 0 : 12)).current;

  function pick(val: boolean) {
    if (answer !== undefined) return;
    onPick(val);
    Animated.parallel([
      Animated.timing(empOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(empY, { toValue: 0, friction: 7, useNativeDriver: true }),
    ]).start();
  }

  const isYes = answer === true;
  const picked = answer !== undefined;

  return (
    <ScrollView contentContainerStyle={p.quizPage} bounces={false}>
      <Text style={p.quizEmoji}>{emoji}</Text>
      <Text style={p.quizQuestion}>{question}</Text>

      <View style={p.choices}>
        <TouchableOpacity
          style={[p.choice, picked && answer === true && p.choiceYes, picked && answer === false && p.choiceUnpicked]}
          onPress={() => pick(true)}
          activeOpacity={0.8}
        >
          <Text style={p.choiceEmoji}>✅</Text>
          <Text style={[p.choiceText, picked && answer === true && p.choiceTextYes]}>{yesLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[p.choice, picked && answer === false && p.choiceNo, picked && answer === true && p.choiceUnpicked]}
          onPress={() => pick(false)}
          activeOpacity={0.8}
        >
          <Text style={p.choiceEmoji}>🤔</Text>
          <Text style={[p.choiceText, picked && answer === false && p.choiceTextNo]}>{noLabel}</Text>
        </TouchableOpacity>
      </View>

      {picked && (
        <Animated.View style={[p.empathy, isYes ? p.empYes : p.empNo, { opacity: empOpacity, transform: [{ translateY: empY }] }]}>
          <Text style={[p.empText, isYes ? p.empTextYes : p.empTextNo]}>
            {isYes ? empathyYes : empathyNo}
          </Text>
        </Animated.View>
      )}

      <View style={{ flex: 1, minHeight: 24 }} />

      {picked && <Btn label="Продолжить →" onPress={onNext} />}
    </ScrollView>
  );
}

// ─── Step 2: Feature — Screen time ───────────────────────────────────────────

function StepFeatureScreenTime({ onNext }: { onNext: () => void }) {
  const numAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(numAnim,  { toValue: 1, duration: 1200, useNativeDriver: false }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 500,  useNativeDriver: true }),
    ]).start();
  }, []);

  const pctText = numAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '62%'] });

  return (
    <Animated.View style={[p.page, { opacity: fadeAnim }]}>
      <View style={p.statCard}>
        <Animated.Text style={p.statBig}>{pctText}</Animated.Text>
        <Text style={p.statLabel}>среднее сокращение экранного времени{'\n'}у детей родителей Kakai</Text>
      </View>

      <View style={p.featureList}>
        {[
          { emoji: '⏱', title: 'Лимит по времени', desc: 'Установите дневной лимит для каждого приложения или для телефона целиком' },
          { emoji: '🔒', title: 'Мгновенная блокировка', desc: 'Заблокируйте телефон одним нажатием из любой точки' },
          { emoji: '📊', title: 'Подробная статистика', desc: 'Видите какие приложения отнимают больше всего времени' },
        ].map(({ emoji, title, desc }) => (
          <View key={title} style={p.featureRow}>
            <View style={p.featureIcon}>
              <Text style={p.featureEmoji}>{emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={p.featureTitle}>{title}</Text>
              <Text style={p.featureDesc}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <Btn label="Понятно →" onPress={onNext} />
    </Animated.View>
  );
}

// ─── Step 4: Feature — Schedule ───────────────────────────────────────────────

function StepFeatureSchedule({ onNext }: { onNext: () => void }) {
  const card1 = useRef(new Animated.Value(0)).current;
  const card2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(300, [
      Animated.spring(card1, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.spring(card2, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  function ScheduleCard({ emoji, label, time, days, color, anim }: {
    emoji: string; label: string; time: string; days: string; color: string; anim: Animated.Value;
  }) {
    return (
      <Animated.View style={[p.schedCard, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }]}>
        <View style={[p.schedIcon, { backgroundColor: color + '22' }]}>
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={p.schedLabel}>{label}</Text>
          <Text style={[p.schedTime, { color }]}>{time}</Text>
          <Text style={p.schedDays}>{days}</Text>
        </View>
        <Text style={{ fontSize: 20 }}>🔒</Text>
      </Animated.View>
    );
  }

  return (
    <View style={p.page}>
      <Text style={p.featureHeadEmoji}>📅</Text>
      <Text style={p.featureHead}>Телефон сам знает{'\n'}когда засыпать</Text>
      <Text style={p.featureSubhead}>Задайте расписание один раз — и Kakai будет автоматически блокировать телефон в нужное время</Text>

      <ScheduleCard
        emoji="🌙" label="Ночной режим"
        time="22:00 – 07:00" days="Каждый день"
        color="#6D28D9" anim={card1}
      />
      <ScheduleCard
        emoji="🏫" label="Школа"
        time="08:00 – 14:30" days="Пн – Пт"
        color="#D97706" anim={card2}
      />

      <View style={p.schedBadge}>
        <Text style={p.schedBadgeText}>✨ Работает автоматически, без вашего участия</Text>
      </View>

      <View style={{ flex: 1 }} />
      <Btn label="Понятно →" onPress={onNext} />
    </View>
  );
}

// ─── Step 6: Feature — GPS ────────────────────────────────────────────────────

function StepFeatureGps({ onNext }: { onNext: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={p.page}>
      <Text style={p.featureHeadEmoji}>📍</Text>
      <Text style={p.featureHead}>Всегда знайте{'\n'}где ваш ребёнок</Text>

      {/* Mini map mock */}
      <View style={p.gpsMapWrap}>
        <View style={p.gpsMapBg}>
          {/* Roads */}
          <View style={[p.gpsRoad, { top: '45%', left: 0, right: 0, height: 8 }]} />
          <View style={[p.gpsRoad, { left: '40%', top: 0, bottom: 0, width: 8 }]} />
          {/* Blocks */}
          <View style={[p.gpsBlock, { top: '5%', left: '5%', width: '30%', height: '35%' }]} />
          <View style={[p.gpsBlock, { top: '5%', left: '45%', width: '25%', height: '35%' }]} />
          <View style={[p.gpsBlock, { top: '5%', left: '75%', width: '20%', height: '35%' }]} />
          <View style={[p.gpsBlock, { top: '55%', left: '5%', width: '30%', height: '35%' }]} />
          <View style={[p.gpsBlock, { top: '55%', left: '45%', width: '48%', height: '35%' }]} />
          {/* Pin */}
          <Animated.View style={[p.gpsPinRing, { transform: [{ scale: pulse }] }]} />
          <View style={p.gpsPinDot} />
        </View>

        {/* Status overlay */}
        <View style={p.gpsStatusBadge}>
          <View style={p.gpsOnlineDot} />
          <Text style={p.gpsStatusText}>В сети · 2 мин назад</Text>
        </View>
      </View>

      <View style={p.featureList}>
        {[
          { emoji: '🔴', text: 'Обновление местоположения в реальном времени' },
          { emoji: '📋', text: 'История маршрута за последние 30 дней' },
          { emoji: '🗺️', text: 'Открыть в Google Maps или Яндекс Картах' },
        ].map(({ emoji, text }) => (
          <View key={text} style={p.gpsBulletRow}>
            <Text style={p.gpsBulletDot}>{emoji}</Text>
            <Text style={p.gpsBulletText}>{text}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <Btn label="Понятно →" onPress={onNext} />
    </View>
  );
}

// ─── Step 8: Social proof — Reviews ──────────────────────────────────────────

const REVIEWS = [
  { name: 'Айгерим М.',  city: 'Алматы',  text: 'Наконец-то нашла приложение которое реально работает. Сын сам стал выполнять задания чтобы получить больше времени!', stars: 5 },
  { name: 'Бекзат К.',   city: 'Астана',  text: 'Настроил расписание за 5 минут. Телефон дочки теперь сам выключается в 22:00. Она спит намного лучше.', stars: 5 },
  { name: 'Наталья Р.',  city: 'Шымкент', text: 'GPS очень помогает. Вижу что ребёнок добрался до школы и домой вернулся. Спокойствие бесценно.', stars: 5 },
];

function StepReviews({ onNext }: { onNext: () => void }) {
  const anims = useRef(REVIEWS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(200, anims.map((a) =>
      Animated.spring(a, { toValue: 1, friction: 6, useNativeDriver: true })
    )).start();
  }, []);

  return (
    <View style={p.page}>
      <Text style={p.featureHeadEmoji}>⭐</Text>
      <Text style={p.featureHead}>Родители уже{'\n'}доверяют Kakai</Text>
      <Text style={p.featureSubhead}>4.9 · более 2 000 семей в Казахстане</Text>

      <View style={{ gap: 12 }}>
        {REVIEWS.map((r, i) => (
          <Animated.View key={i} style={[p.reviewCard, {
            opacity: anims[i],
            transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          }]}>
            <Text style={p.reviewStars}>{'⭐'.repeat(r.stars)}</Text>
            <Text style={p.reviewText}>"{r.text}"</Text>
            <Text style={p.reviewAuthor}>{r.name}, {r.city}</Text>
          </Animated.View>
        ))}
      </View>

      <View style={{ flex: 1, minHeight: 20 }} />
      <Btn label="Продолжить →" onPress={onNext} />
    </View>
  );
}

// ─── Step 9: Loading / Personalization ───────────────────────────────────────

const LOADING_ITEMS = [
  'Анализируем ваши ответы',
  'Подбираем настройки экранного времени',
  'Готовим персональный план',
  'Kakai настроен для вашей семьи ✨',
];

function StepLoading({ onDone }: { onDone: () => void }) {
  const [checked, setChecked] = useState<number[]>([]);
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    LOADING_ITEMS.forEach((_, i) => {
      timers.push(setTimeout(() => setChecked((prev) => [...prev, i]), (i + 1) * 700));
    });

    Animated.timing(barAnim, { toValue: 1, duration: LOADING_ITEMS.length * 700 + 200, useNativeDriver: false }).start();

    timers.push(setTimeout(onDone, LOADING_ITEMS.length * 700 + 400));

    return () => timers.forEach(clearTimeout);
  }, []);

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[p.page, p.loadingPage]}>
      <Text style={p.loadingEmoji}>⚙️</Text>
      <Text style={p.loadingTitle}>Настраиваем Kakai{'\n'}для вашей семьи...</Text>

      <View style={p.loadingBarTrack}>
        <Animated.View style={[p.loadingBarFill, { width: barWidth }]} />
      </View>

      <View style={p.loadingItems}>
        {LOADING_ITEMS.map((item, i) => {
          const done = checked.includes(i);
          const active = !done && checked.length === i;
          return (
            <View key={i} style={p.loadingRow}>
              <View style={[p.loadingDot, done && p.loadingDotDone, active && p.loadingDotActive]}>
                {done ? <Text style={p.loadingDotText}>✓</Text> : active ? <Text style={p.loadingDotText}>…</Text> : null}
              </View>
              <Text style={[p.loadingItemText, done && p.loadingItemDone]}>{item}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Onboarding Screen ───────────────────────────────────────────────────

const QUIZ_DATA: Record<number, {
  emoji: string; question: string;
  yesLabel: string; noLabel: string;
  empathyYes: string; empathyNo: string;
}> = {
  1: {
    emoji: '📱',
    question: 'Ваш ребёнок проводит слишком много времени с телефоном?',
    yesLabel: 'Да, это проблема',
    noLabel: 'Пока не замечаю',
    empathyYes: 'Вы не одни. Дети в Казахстане проводят в среднем 6+ часов в телефоне ежедневно. Kakai помогает родителям вернуть контроль мягко и без конфликтов.',
    empathyNo: 'Отлично! Но с ростом ребёнка это часто меняется. Лучше иметь инструмент заранее — и настроить его на свои правила.',
  },
  3: {
    emoji: '🌙',
    question: 'Ребёнок сидит в телефоне допоздна вместо сна?',
    yesLabel: 'Да, это проблема',
    noLabel: 'Нет, соблюдает режим',
    empathyYes: 'Синий свет экрана задерживает засыпание на 1–2 часа. Расписание Kakai автоматически блокирует телефон в нужное время — ребёнок не сможет его обойти.',
    empathyNo: 'Хороший режим сна — залог успешной учёбы. Kakai поможет сохранить его даже когда ребёнок подрастёт.',
  },
  5: {
    emoji: '📍',
    question: 'Беспокоитесь где находится ребёнок когда он не дома?',
    yesLabel: 'Да, переживаю',
    noLabel: 'Нет, всегда на связи',
    empathyYes: 'Это абсолютно нормально. GPS-трекер Kakai показывает местоположение в реальном времени и сохраняет историю маршрута.',
    empathyNo: 'Приятно слышать! GPS в Kakai всегда под рукой на случай если ребёнок задержится или выключит телефон.',
  },
  7: {
    emoji: '✅',
    question: 'Хотите мотивировать ребёнка выполнять задания и обязанности?',
    yesLabel: 'Да, было бы здорово',
    noLabel: 'Пока не думал об этом',
    empathyYes: 'В Kakai ребёнок получает дополнительное экранное время за выполненные задания. Это работает — дети сами просят давать им новые задания!',
    empathyNo: 'Попробуйте — это неожиданно эффективно. Ребёнок сам начинает просить задания в обмен на экранное время.',
  },
};

export default function OnboardingIndex() {
  const router = useRouter();
  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  function animateTo(nextStep: number) {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  }

  function next() {
    if (step < STEP_COUNT - 1) animateTo(step + 1);
    else router.replace('/(onboarding)/paywall');
  }

  function skip() {
    router.replace('/(onboarding)/paywall');
  }

  function pickAnswer(stepIdx: number, val: boolean) {
    setAnswers((prev) => ({ ...prev, [stepIdx]: val }));
  }

  const progress = step / (STEP_COUNT - 1);
  const showSkip = step > 0 && step < STEP_COUNT - 1;

  function renderStep() {
    switch (step) {
      case 0: return <StepWelcome onNext={next} />;

      case 1:
      case 3:
      case 5:
      case 7: {
        const d = QUIZ_DATA[step];
        return (
          <StepQuiz
            emoji={d.emoji}
            question={d.question}
            yesLabel={d.yesLabel}
            noLabel={d.noLabel}
            empathyYes={d.empathyYes}
            empathyNo={d.empathyNo}
            answer={answers[step]}
            onPick={(v) => pickAnswer(step, v)}
            onNext={next}
          />
        );
      }

      case 2: return <StepFeatureScreenTime onNext={next} />;
      case 4: return <StepFeatureSchedule onNext={next} />;
      case 6: return <StepFeatureGps onNext={next} />;
      case 8: return <StepReviews onNext={next} />;
      case 9: return <StepLoading onDone={() => router.replace('/(onboarding)/paywall')} />;

      default: return null;
    }
  }

  return (
    <View style={s.container}>
      {/* Progress header */}
      <View style={s.header}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        {showSkip && (
          <TouchableOpacity onPress={skip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.skipText}>Пропустить</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Animated step content */}
      <Animated.View style={[s.stepWrap, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {renderStep()}
      </Animated.View>
    </View>
  );
}

// ─── Main styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FBF7' },

  header: {
    paddingTop: 54, paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  progressTrack: {
    flex: 1, height: 5, backgroundColor: '#C8E8D5',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#0FA968', borderRadius: 3 },
  skipText: { fontSize: 14, color: '#6B7B6E', fontWeight: '600' },

  stepWrap: { flex: 1 },
});

// ─── Page-level styles ────────────────────────────────────────────────────────

const p = StyleSheet.create({
  page: { flex: 1, padding: 24, paddingBottom: 40 },

  // Welcome
  welcomeLogo:  { fontSize: 72, textAlign: 'center', marginTop: 24, marginBottom: 8 },
  welcomeTitle: { fontSize: 36, fontWeight: '900', color: '#0FA968', textAlign: 'center', marginBottom: 6 },
  welcomeSub:   { fontSize: 16, color: '#6B7B6E', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  welcomeDots:  { gap: 10, marginBottom: 28 },
  welcomeDotRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  welcomeDotDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0FA968' },
  welcomeDotText: { fontSize: 15, fontWeight: '600', color: '#0D1B12' },
  welcomeHint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  // Quiz
  quizPage:     { flexGrow: 1, padding: 24, paddingBottom: 40 },
  quizEmoji:    { fontSize: 56, textAlign: 'center', marginBottom: 16 },
  quizQuestion: { fontSize: 22, fontWeight: '800', color: '#0D1B12', textAlign: 'center', lineHeight: 30, marginBottom: 32 },
  choices:      { gap: 12, marginBottom: 4 },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'white', borderRadius: 16, padding: 18,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  choiceYes:      { borderColor: '#0FA968', backgroundColor: '#E6F9F0' },
  choiceNo:       { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  choiceUnpicked: { opacity: 0.45 },
  choiceEmoji:    { fontSize: 24 },
  choiceText:     { flex: 1, fontSize: 16, fontWeight: '600', color: '#374151' },
  choiceTextYes:  { color: '#065F46' },
  choiceTextNo:   { color: '#991B1B' },
  empathy: { borderRadius: 16, padding: 18, marginTop: 20, marginBottom: 8 },
  empYes:  { backgroundColor: '#F0FDF4' },
  empNo:   { backgroundColor: '#F0FDF4' },
  empText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  empTextYes: { color: '#065F46' },
  empTextNo:  { color: '#065F46' },

  // Feature (shared)
  featureHeadEmoji: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  featureHead:      { fontSize: 24, fontWeight: '800', color: '#0D1B12', textAlign: 'center', lineHeight: 32, marginBottom: 8 },
  featureSubhead:   { fontSize: 14, color: '#6B7B6E', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  featureList: { gap: 16, marginBottom: 24 },
  featureRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featureIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#E6F9F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  featureEmoji: { fontSize: 22 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: '#0D1B12', marginBottom: 2 },
  featureDesc:  { fontSize: 13, color: '#6B7B6E', lineHeight: 18 },

  // Screen time stat card
  statCard: {
    backgroundColor: '#0D1B12', borderRadius: 20, padding: 28,
    alignItems: 'center', marginBottom: 28,
  },
  statBig:   { fontSize: 64, fontWeight: '900', color: '#0FA968', marginBottom: 6 },
  statLabel: { fontSize: 13, color: '#8BA897', textAlign: 'center', lineHeight: 18 },

  // Schedule
  schedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'white', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  schedIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  schedLabel: { fontSize: 15, fontWeight: '700', color: '#0D1B12', marginBottom: 2 },
  schedTime:  { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  schedDays:  { fontSize: 12, color: '#6B7B6E' },
  schedBadge: {
    backgroundColor: '#E6F9F0', borderRadius: 12,
    padding: 14, alignItems: 'center', marginTop: 4, marginBottom: 16,
  },
  schedBadgeText: { fontSize: 13, color: '#065F46', fontWeight: '600' },

  // GPS
  gpsMapWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 20, position: 'relative' },
  gpsMapBg: {
    height: 160, backgroundColor: '#EDF7F2',
    justifyContent: 'center', alignItems: 'center',
  },
  gpsRoad:  { position: 'absolute', backgroundColor: '#FFFFFF' },
  gpsBlock: { position: 'absolute', backgroundColor: '#C8DDD4', borderRadius: 3 },
  gpsPinRing: {
    position: 'absolute',
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: '#0FA96860', backgroundColor: '#0FA96820',
  },
  gpsPinDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#0FA968', borderWidth: 3, borderColor: 'white',
    position: 'absolute',
  },
  gpsStatusBadge: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0D1B12CC', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  gpsOnlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#0FA968' },
  gpsStatusText: { fontSize: 11, color: 'white', fontWeight: '600' },
  gpsBulletRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  gpsBulletDot:  { fontSize: 14, flexShrink: 0 },
  gpsBulletText: { fontSize: 14, color: '#374151', flex: 1, lineHeight: 20 },

  // Reviews
  reviewCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  reviewStars:  { fontSize: 14, marginBottom: 8 },
  reviewText:   { fontSize: 14, color: '#374151', lineHeight: 20, fontStyle: 'italic', marginBottom: 8 },
  reviewAuthor: { fontSize: 12, color: '#6B7B6E', fontWeight: '600' },

  // Loading
  loadingPage:     { justifyContent: 'center', alignItems: 'center' },
  loadingEmoji:    { fontSize: 60, marginBottom: 16 },
  loadingTitle:    { fontSize: 22, fontWeight: '800', color: '#0D1B12', textAlign: 'center', lineHeight: 30, marginBottom: 32 },
  loadingBarTrack: {
    width: '100%', height: 6, backgroundColor: '#C8E8D5',
    borderRadius: 3, overflow: 'hidden', marginBottom: 32,
  },
  loadingBarFill: { height: '100%', backgroundColor: '#0FA968', borderRadius: 3 },
  loadingItems:   { width: '100%', gap: 16 },
  loadingRow:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  loadingDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center',
  },
  loadingDotDone:   { backgroundColor: '#0FA968' },
  loadingDotActive: { backgroundColor: '#FEF3C7' },
  loadingDotText:   { fontSize: 13, fontWeight: '700', color: 'white' },
  loadingItemText:  { fontSize: 15, color: '#6B7B6E', flex: 1 },
  loadingItemDone:  { color: '#0D1B12', fontWeight: '600' },
});
