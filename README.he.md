<div align="center">

# Claude Desktop RTL Patch

**תמיכה אמיתית בעברית וערבית (כיווניות מימין-לשמאל) ל-Claude Desktop ב-Windows.**

מזהה טקסט RTL אוטומטית והופך את הכיווניות במקומות הנכונים — תוך שמירה על אנגלית ובלוקי קוד משמאל-לימין.

[English](README.md) · [עברית](README.he.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6.svg)](#-דרישות)
[![PowerShell 5.1+](https://img.shields.io/badge/PowerShell-5.1%2B-5391FE.svg)](#-דרישות)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-תרומה-לפרויקט)
[![GitHub stars](https://img.shields.io/github/stars/shraga100/claude-desktop-rtl-patch?style=social)](https://github.com/shraga100/claude-desktop-rtl-patch/stargazers)

</div>

---

<div dir="rtl">

## ✨ מה זה עושה

- **מזהה טקסט RTL אוטומטית** בתשובות של Claude ובתיבת הקלט, ומחיל את הכיווניות הנכונה בזמן אמת — אפילו בזמן שתשובה עדיין נכתבת (streaming).
- **שומר על בלוקי קוד (ועל אנגלית) משמאל-לימין** כך שהעיצוב לעולם לא נשבר.
- **מתקן את ממשק החלון השבור במערכות RTL** — ראו ההערה למטה.
- **מגבה כל קובץ שהוא נוגע בו**, עם שחזור בלחיצה אחת ו-rollback אוטומטי אם משהו משתבש.
- **נשאר מותקן גם אחרי עדכונים** (אופציונלי) באמצעות קיצור דרך לשולחן העבודה או שירות עדכון אוטומטי ברקע.

> **📝 הערה:** במערכת Windows ששפת התצוגה שלה מוגדרת לעברית/ערבית, כל ממשק החלון של Claude Desktop מתהפך ל-RTL **מעצמו — זהו באג קיים, שלא נגרם מהפאצ'.** הוא דוחף את כפתורי פס הכותרת (מזעור / הגדלה / סגירה) אל מעל כפתורי ההגדרות והניווט של Claude ומסתיר אותם, ושולח את חלון התצוגה המקדימה (frame-peek) לקצה השמאלי. הפאצ' **מתקן** את זה בכך שהוא כופה את כיווניות מסגרת החלון בחזרה ל-LTR, בלי לפגוע בכיווניות של טקסט השיחה עצמו.

---

## 🚀 התקנה מהירה

פתחו את **Windows PowerShell** והריצו:

<div dir="ltr">

```powershell
irm https://raw.githubusercontent.com/shraga100/claude-desktop-rtl-patch/main/install.ps1 | iex
```

</div>

תופיע בקשת UAC — לחצו **Yes** כדי לאשר הרשאות מנהל, ואז בחרו **1. Install** מהתפריט.

> **💡 טיפ:** לא רוצים להעביר ל-`iex`? הורידו את `patch.ps1` מהריפו, לחצו עליו קליק ימני, ובחרו **Run with PowerShell**.

---

## 📋 דרישות

| דרישה | הערות |
| :--- | :--- |
| **Windows 10 / 11** | עם Claude Desktop מותקן ([הורדה](https://downloads.claude.ai/releases/win32/ClaudeSetup.exe)) |
| **Node.js** | <span dir="ltr">`npx`</span> חייב להיות ב-PATH ([nodejs.org](https://nodejs.org/)) — משמש לאריזה מחדש של ארכיון האפליקציה |
| **הרשאות מנהל** | המתקין מתרומם אוטומטית דרך UAC |

> **⚠️ חשוב:** **Windows בלבד.** ב-macOS השתמשו ב-[פאצ' של soguy](https://github.com/soguy/claude-desktop-rtl-mac) במקום. *(לא בדקתי את גרסת ה-Mac באופן אישי — שימוש על אחריותכם.)*

---

## 🎛️ אפשרויות התפריט

כשמריצים את הסקריפט מקבלים תפריט אינטראקטיבי:

| # | אפשרות | מה היא עושה |
| :---: | :--- | :--- |
| **1** | Install Smart RTL Patch | מגבה את הקבצים המקוריים ומזריק תמיכת RTL |
| **2** | Restore Original State | מבטל כל שינוי ומסיר את התעודה |
| **3** | Create 'Quick Update' Shortcut | מוסיף קיצור דרך לשולחן העבודה לפיצ'ינג מחדש בלחיצה |
| **4** | Enable Auto Re-Patch | מתקין צופה ברקע שמפצ'ץ מחדש אחרי כל עדכון של Claude |
| **5** | Disable Auto Re-Patch | מסיר את הצופה הרקעי הזה |
| **6** | Exit | סוגר את המתקין |

---

## 🔄 לשמור על הפאצ' מותקן

Claude Desktop מתעדכן לעיתים קרובות, וכל עדכון דורס את הפאצ'. שתי אפשרויות אופציונליות הופכות את זה לפשוט:

- **קיצור Quick Update (אפשרות 3)** — קיצור דרך בשם **"Update Claude RTL"**. לחיצה כפולה עליו מורידה ומחילה מחדש את הגרסה האחרונה בשקט.
- **עדכון אוטומטי (אפשרות 4)** — משימה מתוזמנת קלילה של Windows שמזהה מתי גרסת <span dir="ltr">`claude.exe`</span> חדשה עולה, מחילה את הפאצ' מחדש אוטומטית, ומציגה התראה בסיום.

---

## 🗑️ הסרה

הריצו את הסקריפט ובחרו **2. Restore Original State**. זה משחזר את כל הקבצים המקוריים מהגיבוי ומסיר את התעודה החתומה-עצמית ממאגר התעודות של Windows. אם הפעלתם את העדכון האוטומטי, בחרו גם **5. Disable Auto Re-Patch**.

---

## 🛠️ פתרון תקלות

**"Node.js (npx) is required"** — התקינו Node.js מ-[nodejs.org](https://nodejs.org/) ופתחו מחדש את PowerShell.

**Claude לא עולה אחרי הפיצ'ינג** — הריצו שוב את הסקריפט, בחרו **2 (Restore)**, ואז **1 (Install)**.

**Claude התעדכן והפאצ' נשבר** — הריצו את קיצור "Update Claude RTL", או השתמשו בעדכון האוטומטי. לתיקון ידני, מחקו קבצי <span dir="ltr">`.bak`</span> מתיקיית האפליקציה של Claude והריצו שוב את המתקין.

**`Import-Module … The member AuditToString is already present`** — הרצתם את הפקודה ב-**PowerShell 7 (`pwsh`)**, שיש בו באג ידוע ששובר את הפאצ'. השתמשו במקום זאת ב-**Windows PowerShell** המובנה:

1. הקישו **Win + R**, הקלידו <span dir="ltr">`powershell`</span>, והקישו **Enter** — זה פותח את חלון Windows PowerShell ה**כחול** הקלאסי (לא את ה-`pwsh` השחור).
2. הדביקו את פקודת ההתקנה והריצו.

---

<details>
<summary><b>🔍 איך זה עובד (טכני)</b></summary>

<div dir="rtl">

Claude Desktop היא אפליקציית Electron **חתומה דיגיטלית**, ולכן עריכת קוד הממשק שלה שוברת את בדיקות השלמות. הפאצ' עוקף את זה בשלושה שלבים — כולם אטומיים, עם rollback אוטומטי בכשל:

**1 — הזרקת ASAR.** הממשק של Claude נמצא בתוך <span dir="ltr">`app.asar`</span>. הסקריפט מחלץ אותו עם <span dir="ltr">`npx @electron/asar`</span>, מוסיף קטע קוד קצר לזיהוי RTL לקבצי ה-renderer (וכופה את ממשק החלון ל-LTR ב-main process), אורז מחדש את הארכיון, ומחשב hash חדש של SHA-256 לכותרת שלו.

**2 — החלפת hash בתוך <span dir="ltr">`claude.exe`</span>.** ה-hash המקורי של ה-ASAR שמור כמחרוזת ASCII בתוך <span dir="ltr">`claude.exe`</span>. הסקריפט מבצע חיפוש-והחלפה ברמת הבייט כדי לעדכן אותו. אם הפורמט אי-פעם משתנה, יש fallback לכיבוי ה-Electron integrity fuse.

**3 — החלפת תעודה בתוך <span dir="ltr">`cowork-svc.exe`</span>.** השירות הזה מאמת את <span dir="ltr">`claude.exe`</span> מול התעודה המוטמעת של Anthropic. הסקריפט מאתר את התעודה הזו (ע"י התאמת דפוס סביב המחרוזת <span dir="ltr">`"Anthropic, PBC"`</span>), מחליף אותה במקום בתעודה חתומה-עצמית (מרופדת ב-<span dir="ltr">`0x00`</span> כדי לשמר את גודל הקובץ), חותם מחדש את שני הקבצים, מוסיף את התעודה החדשה למאגר ה-trusted root של Windows, ואז **מוחק את המפתח הפרטי**.

כל הקבצים המקוריים מגובים כקבצי <span dir="ltr">`.bak`</span> ליד המקור לפני שמשהו משתנה.

</div>

</details>

<details>
<summary><b>🔐 אבטחה ואימות</b></summary>

<div dir="rtl">

<span dir="ltr">`install.ps1`</span> מאמת **חתימת RSA-4096** מעל <span dir="ltr">`patch.ps1`</span> לפני שהוא מריץ אותו. ריפו GitHub פרוץ לבדו **אינו** מספיק כדי להפיץ קוד זדוני — התוקף היה צריך גם את המפתח הפרטי הלא-מקוון של המתחזק.

**טביעת אצבע של המפתח הציבורי (SHA-256):**

<div dir="ltr">

```
6e:f4:c2:a6:c2:42:34:a1:5f:e5:cd:e5:5d:a5:b0:3c:94:64:b4:56:7f:81:04:7c:83:9a:50:1c:7c:6f:07:c9
```

</div>

חשבו מחדש את טביעת האצבע של המפתח המוטמע ב-<span dir="ltr">`install.ps1`</span> וודאו שהיא תואמת:

<div dir="ltr">

```powershell
$content = Invoke-RestMethod "https://raw.githubusercontent.com/shraga100/claude-desktop-rtl-patch/main/install.ps1"
if ($content -match "ExpectedPubKey\s*=\s*'([A-Za-z0-9+/=]+)'") {
    $bytes = [Convert]::FromBase64String($matches[1])
    $hash  = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    ([BitConverter]::ToString($hash)).Replace('-', ':').ToLower()
}
```

</div>

אי-התאמה משמעותה שהמפתח המוטמע הוחלף — **אל תמשיכו**; דווחו על כך כבעיית אבטחה.

לבדיקת גרסה בלי להתקין:

<div dir="ltr">

```powershell
git clone https://github.com/shraga100/claude-desktop-rtl-patch
cd claude-desktop-rtl-patch
powershell -ExecutionPolicy Bypass -File tools\verify-signature.ps1
```

</div>

**למתחזקים:** התקינו את ה-pre-commit hook פעם אחת עם <span dir="ltr">`tools\install-hooks.ps1`</span>, וחתמו מחדש אחרי עריכת <span dir="ltr">`patch.ps1`</span>:

<div dir="ltr">

```powershell
powershell -ExecutionPolicy Bypass -File tools\sign-release.ps1
git add patch.ps1 patch.ps1.sig
```

</div>

ה-hook חוסם כל commit שנוגע ב-<span dir="ltr">`patch.ps1`</span>, <span dir="ltr">`patch.ps1.sig`</span> או <span dir="ltr">`install.ps1`</span> אם החתימה לא תואמת, כך ש-re-sign שנשכח לא יכול להגיע ל-<span dir="ltr">`main`</span>.

</div>

</details>

---

## ⚠️ כתב ויתור

> **🛑 זהירות:** הפאצ' הזה משנה את הבינאריים של Claude Desktop בדרכים **שאינן מאושרות ע"י Anthropic**. הוא מחליף את תעודת חתימת-הקוד של Anthropic בתוך <span dir="ltr">`cowork-svc.exe`</span> בתעודה חתומה-עצמית, מוסיף את התעודה הזו למאגר ה-**trusted root** של Windows, ועוקף את אימות השלמות של האפליקציה.

בהתקנה, אתם מקבלים ש:

1. **השימוש על אחריותכם.** הכותבים אינם אחראים לנזק למערכת, אובדן מידע או חוסר יציבות.
2. **Anthropic עשויה לסגור את החשבון שלכם** בגין שינויים לא מאושרים, בהתאם לתנאי השימוש שלה.
3. **אתם סומכים על הריפו הזה.** הרצת <span dir="ltr">`irm | iex`</span> כמנהל מריצה קוד עם הרשאות מלאות — תמיד אמתו את המקור.
4. **זה זמני.** עדכוני Claude דורסים את הקבצים המתוקנים; הריצו שוב את המתקין (או השתמשו בעדכון האוטומטי) אחרי כל עדכון.
5. **זה פתרון ביניים** עד ש-Anthropic תוסיף תמיכת RTL מובנית. בבקשה בקשו את הפיצ'ר הזה דרך הערוצים הרשמיים.

---

## 🤝 תרומה לפרויקט

הפרויקט הוא קוד פתוח תחת רישיון **MIT**. תרומות שמשפרות את דיוק ה-RTL מתקבלות בברכה — PRs פתוחים. 🙏

## רישיון

[MIT](LICENSE)

</div>
