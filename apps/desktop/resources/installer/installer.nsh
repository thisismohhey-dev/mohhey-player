; M. Player installer: a step-by-step wizard (welcome > licence > folder > install > finish) in the app's colours.
; Text is provided for English (1033) and Persian (1065). Saved as UTF-8 with BOM so NSIS reads the Persian text.

BrandingText "M. Player"

!macro customHeader
  ; Farsi.nsh (NSIS 3.0.4) lacks these; defining them first keeps the build warning-free.
  !define MULTIUSER_TEXT_INSTALLMODE_TITLE "انتخاب کاربران"
  !define MULTIUSER_TEXT_INSTALLMODE_SUBTITLE "مشخص کنید برای کدام کاربران نصب شود."
  !define MULTIUSER_INNERTEXT_INSTALLMODE_TOP "مشخص کنید فقط برای خودتان نصب شود یا برای همه‌ی کاربران این رایانه."
  !define MULTIUSER_INNERTEXT_INSTALLMODE_ALLUSERS "نصب برای همه‌ی کاربران این رایانه"
  !define MULTIUSER_INNERTEXT_INSTALLMODE_CURRENTUSER "نصب فقط برای من"
  !insertmacro MUI_LANGUAGE "Farsi"
!macroend

LangString WelcomeTitle 1033 "Welcome to M. Player"
LangString WelcomeTitle 1065 "به M. Player خوش آمدید"
LangString WelcomeText 1033 "This wizard installs M. Player, an offline music player, step by step.$\r$\n$\r$\nNothing is chosen for you: you will review the licence and pick the install folder yourself. M. Player never connects to the internet and never touches your music files.$\r$\n$\r$\nClick Next to continue."
LangString WelcomeText 1065 "این نصاب، M. Player (پخش‌کننده‌ی آفلاین موسیقی) را مرحله‌به‌مرحله نصب می‌کند.$\r$\n$\r$\nهیچ چیز از پیش برای شما انتخاب نشده است: مجوز را می‌خوانید و پوشه‌ی نصب را خودتان انتخاب می‌کنید. M. Player هرگز به اینترنت وصل نمی‌شود و به فایل‌های موسیقی شما دست نمی‌زند.$\r$\n$\r$\nبرای ادامه روی «بعدی» بزنید."
LangString RemoveDataPrompt 1033 "Also delete your M. Player library data (playlists, play counts, settings)?$\r$\n$\r$\nYour music files are never deleted."
LangString RemoveDataPrompt 1065 "اطلاعات کتابخانه‌ی M. Player (پلی‌لیست‌ها، تعداد پخش، تنظیمات) هم حذف شود؟$\r$\n$\r$\nفایل‌های موسیقی شما هرگز حذف نمی‌شوند."

; Persian versions of electron-builder's built-in messages (it only ships English for these).
LangString appRunning 1065 "${PRODUCT_NAME} در حال اجراست.$\r$\nبرای بستن آن روی تأیید بزنید. اگر بسته نشد، آن را دستی ببندید."
LangString appCannotBeClosed 1065 "${PRODUCT_NAME} بسته نمی‌شود.$\r$\nلطفاً آن را دستی ببندید و برای ادامه روی «تلاش مجدد» بزنید."
LangString installing 1065 "در حال نصب، لطفاً صبر کنید..."
LangString areYouSureToUninstall 1065 "آیا مطمئنید که می‌خواهید ${PRODUCT_NAME} را حذف کنید؟"
LangString decompressionFailed 1065 "باز کردن فایل‌ها ناموفق بود. لطفاً نصاب را دوباره اجرا کنید."
LangString uninstallFailed 1065 "حذف فایل‌های نسخه‌ی قبلی ناموفق بود. لطفاً نصاب را دوباره اجرا کنید."
LangString appClosing 1065 "در حال بستن ${PRODUCT_NAME}..."
LangString win7Required 1065 "ویندوز ۷ یا بالاتر لازم است"
LangString x64WinRequired 1065 "ویندوز ۶۴ بیتی لازم است"

; Persian versions of the (unused, per-user only) install-mode page texts; NSIS requires every language to define them.
LangString chooseInstallationOptions 1065 "گزینه‌های نصب"
LangString chooseUninstallationOptions 1065 "گزینه‌های حذف"
LangString whichInstallationShouldBeRemoved 1065 "کدام نصب حذف شود؟"
LangString whoShouldThisApplicationBeInstalledFor 1065 "برنامه برای چه کسانی نصب شود؟"
LangString selectUserMode 1065 "مشخص کنید برنامه برای همه‌ی کاربران باشد یا فقط برای خودتان"
LangString whichInstallationRemove 1065 "این برنامه هم برای همه‌ی کاربران و هم برای یک کاربر نصب شده است.$\r$\nکدام نصب حذف شود؟"
LangString freshInstallForAll 1065 "نصب تازه برای همه‌ی کاربران (رمز مدیر لازم است)."
LangString freshInstallForCurrent 1065 "نصب تازه فقط برای کاربر فعلی."
LangString onlyForMe 1065 "فقط برای &من"
LangString forAll 1065 "همه‌ی کاربران این رایانه (&همه)"
LangString loginWithAdminAccount 1065 "برای ادامه باید با حساب مدیر وارد شوید..."
LangString perUserInstallExists 1065 "از قبل یک نصب برای کاربر فعلی وجود دارد."
LangString perUserInstall 1065 "یک نصب برای کاربر فعلی وجود دارد."
LangString perMachineInstallExists 1065 "از قبل یک نصب برای همه‌ی کاربران وجود دارد."
LangString perMachineInstall 1065 "یک نصب برای همه‌ی کاربران وجود دارد."
LangString reinstallUpgrade 1065 "دوباره‌نصب/به‌روزرسانی انجام می‌شود."
LangString uninstall 1065 "حذف انجام می‌شود."

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "$(WelcomeTitle)"
  !define MUI_WELCOMEPAGE_TEXT "$(WelcomeText)"
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Library data lives in %APPDATA%\Mohhey Player. It is kept unless the user says otherwise (never when updating or silent).
!macro customUnInstall
  ${ifNot} ${isUpdated}
  ${ifNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "$(RemoveDataPrompt)" IDNO +2
    RMDir /r "$APPDATA\Mohhey Player"
  ${endIf}
  ${endIf}
!macroend
