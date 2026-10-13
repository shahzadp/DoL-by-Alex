@echo off
SETLOCAL

REM This builder uses the repo's Android SDK at devTools\androidsdk, which
REM outlived the Capacitor builder that originally installed it. Point
REM ANDROID_HOME elsewhere if you keep it somewhere else; the ANDROID_* vars
REM must agree with what Flutter resolves or Gradle and the tool will disagree
REM about which SDK they are using.
SET "ANDROID_HOME=%CD%\..\androidsdk"
SET "ANDROID_SDK_ROOT=%ANDROID_HOME%"
SET "ANDROID_SDK_PATH=%ANDROID_HOME%"
SET "PATH=%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%"

REM flutter is not bundled; add its bin directory to PATH before running this.
where flutter >NUL 2>&1
if errorlevel 1 (
	echo flutter not found on PATH. Install Flutter 3.47.7 stable, or add its
	echo bin directory to PATH, then run setup_deps.bat again.
	echo See README-windows.txt.
	pause
	exit /b 1
)

where java >NUL 2>&1
if errorlevel 1 (
	echo java not found on PATH. JDK 21 is required.
	pause
	exit /b 1
)

REM cmdline-tools 23 deprecates sdkmanager in favour of the "android" CLI, which
REM also writes licenses\ itself, so there is no separate license step.
REM The CLI returns a bogus exit code even on success (and sdkmanager itself
REM crashes outright here), so every step below is verified on disk instead of
REM trusted on ERRORLEVEL. See MEMORY.md trap 7.

echo Installing packages
call android sdk install "platforms;android-36"
if NOT EXIST "%ANDROID_HOME%\platforms\android-36" goto :fail
call android sdk install "build-tools;36.0.0"
if NOT EXIST "%ANDROID_HOME%\build-tools\36.0.0" goto :fail

REM Flutter insists on the NDK at configure time even though nothing here
REM compiles native code: AGP reports a default ndkVersion whether or not the
REM build sets one. See README-windows.txt.
call android sdk install "ndk;28.2.13676358"
if NOT EXIST "%ANDROID_HOME%\ndk\28.2.13676358\source.properties" goto :fail

echo Resolving dart dependencies
call flutter pub get
if errorlevel 1 goto :fail

REM assemble assets/web/ from the compiled game; fails fast if the storage
REM origin has drifted, which would silently wipe every player's saves.
echo Assembling game assets
call node scripts\prepare_flutter_assets.js
if errorlevel 1 goto :fail

echo All Done!
pause
exit /b 0

:fail
echo.
echo Setup failed. See the error above.
pause
exit /b 1