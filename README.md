# kids-filter

ההורה שומר כפתורים עם קישורים לסרטוני YouTube, והילד צופה רק בהם.

## גרסת Web (עכשיו)

- **`/login`** – הרשמה והתחברות של הורה במייל וסיסמה (Google אופציונלי).
- **`/`** – הילדים שלי, הוספת ילד/ה.
- **`/children/:id`** – רשימות סרטונים: מדביקים קישור YouTube והוא הופך לכפתור. סידור, הסרה, הסתרת רשימה, וקוד חיבור למכשיר.
- **`/kid`** – מסך הילד: מקלידים קוד חד-פעמי, ומקבלים כפתורים גדולים. הסרטון מתנגן בנגן מוטמע, ובסוף מוצג מסך שלנו במקום ההמלצות של YouTube.

כדי להעלות ל-Vercel צריך רק `DATABASE_URL`, `DIRECT_DATABASE_URL` (Neon) ו-`AUTH_SECRET`. בלי `YOUTUBE_API_KEY` שם הסרטון והתמונה נשלפים דרך oEmbed, בלי מכסה.

## שלב 1: API לאפליקציית אנדרואיד

## מבנה

```
apps/web/                 Next.js 16 (App Router) – API + דשבורד הורים
  prisma/schema.prisma    10 טבלאות + migration ראשונה (0001_init)
  prisma.config.ts        Prisma 7: חיבור ישיר ל-Neon למיגרציות
  src/lib/decide.ts       מנוע הכללים – פונקציה טהורה, 8 כללים לפי הסדר
  src/lib/classify.ts     סיווג ב-Claude Haiku 5.5 עם פלט מובנה (zod), מטמון משותף
  src/lib/youtube.ts      YouTube Data API: videos / search / playlistItems / comments
  src/app/api/...         כל הנתיבים מטבלת ה-API
packages/shared/          סכמות zod, קודי סיבה ותרגום לעברית, parseVideoId
```

## הרצה מקומית

```bash
npm install
cp apps/web/.env.example apps/web/.env    # למלא מפתחות
npm run db:deploy -w @kids/web            # יוצר את הטבלאות ב-Neon
npm run dev                               # http://localhost:3000
npm test                                  # 30 בדיקות Vitest
```

## API

ההורה מזדהה ב-Google (Auth.js). מכשיר הילד שולח `Authorization: Bearer <deviceToken>`.

| נתיב | מתודה | מי | מה |
|---|---|---|---|
| `/api/children` | GET / POST | הורה | ילדים (כולל מספר בקשות ממתינות) / הוספת ילד עם כללי ברירת מחדל |
| `/api/children/:id/rules` | GET / PUT | הורה | כללים; עדכון שולח Push למכשירים |
| `/api/children/:id/lists` | GET / POST | הורה | רשימות; POST עם `playlist` מייבא פלייליסט |
| `/api/lists/:id` | PATCH / DELETE | הורה | שם, הפעלה/כיבוי, מחיקה |
| `/api/lists/:id/items` | POST / PATCH / DELETE | הורה | הוספה לפי קישור, סידור מחדש, הסרה (`?videoId=`) |
| `/api/children/:id/pairing-code` | POST | הורה | קוד 6 ספרות ל-10 דקות + קישור ל-QR |
| `/api/devices/pair` | POST | מכשיר | קוד ← deviceToken (בשרת נשמר רק hash) |
| `/api/videos/home` | GET | מכשיר | סרטוני הרשימות הפעילות + `searchEnabled` |
| `/api/videos/search?q=` | GET | מכשיר | רק תוצאות מותרות; חסום במצב listOnly |
| `/api/videos/:videoId/check` | GET | מכשיר | ALLOWED / BLOCKED / NEEDS_APPROVAL + סיבה בעברית |
| `/api/requests` | GET / POST | הורה / מכשיר | תור בקשות / בקשת אישור + Push להורה |
| `/api/requests/:id` | PATCH | הורה | אישור/דחייה, `alwaysAllowChannel`, `addToListId` |
| `/api/events` | POST | מכשיר | צפייה וניסיונות עקיפה (batch) |
| `/api/devices/heartbeat` | POST | מכשיר | סימן חיים |
| `/api/parents/fcm-token` | POST | הורה | רישום הנייד של ההורה ל-Push |
| `/api/cron/cleanup` | GET | Vercel cron | תפוגת בקשות (24 ש'), מחיקת היסטוריה (90 יום), התראה על מכשיר שותק |

## החלטות שקיבלתי בדרך

- **Prisma 7** (הגרסה היציבה הנוכחית): ה-URL עבר מהסכמה ל-`prisma.config.ts`, והאפליקציה מתחברת דרך `@prisma/adapter-neon`.
- **deviceToken** נשמר בשרת כ-hash בלבד (`deviceTokenHash`), כמו שכתוב בפרק האבטחה.
- **סרטון שנמצא ברשימה פעילה** מותר גם כשמצב listOnly כבוי.
- **סרטון שלא ניתן להטמעה** נחסם מיד אחרי בדיקת ההחרגה.
- **דחייה של ההורה** נשמרת כ-VideoOverride חסום, כך שהילד לא יבקש שוב את אותו סרטון.
- **סיווג שנכשל או סירוב של המודל** הופכים לביטחון 0, כלומר NEEDS_APPROVAL, ולא נשמרים במטמון.
- **בקשה שלא נענתה** פוקעת אחרי 24 שעות (אחת השאלות הפתוחות – קל לשנות).
- **התחברות**: Google בלבד כרגע. כניסה במייל (magic link) דורשת ספק מייל כמו Resend.

## עוד לא נעשה

- ממשק הדשבורד (כרגע יש רק דף התחברות).
- Rate limit על נתיבי המכשיר.
- מטמון לחיפושים (כל חיפוש עולה 100 יחידות מכסה).
- ב-Vercel Hobby, cron רץ רק פעם ביום. לריצה כל 15 דקות צריך Pro.
