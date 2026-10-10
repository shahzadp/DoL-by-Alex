@echo off
SETLOCAL

SET "PATH=%CD%\androidsdk\cmdline-tools\latest\bin;%PATH%"
SET "ANDROID_HOME=%CD%\androidsdk"
SET "ANDROID_SDK_ROOT=%ANDROID_HOME%"
SET "ANDROID_SDK_PATH=%ANDROID_HOME%"

REM note: the SDK folder is "cmdline-tools" (see README-windows.txt). all three
REM ANDROID_* vars must point at the same SDK so that setup and build agree.
REM Gradle is NOT installed here: Capacitor ships a wrapper in android\.

if NOT EXIST "%CD%\androidsdk\cmdline-tools\latest\bin\android.exe" (
	echo cmdline-tools not found, follow the steps from README-windows.txt first!
	pause
	exit /b 1
)

REM install node dependencies
echo Installing node modules
call npm install --no-audit
if errorlevel 1 goto :fail

REM assemble capwww and sync it into the native project
echo Syncing web assets into the android project
call npm run cap:sync
if errorlevel 1 goto :fail

REM install android platform and build tools.
REM cmdline-tools 23 deprecates sdkmanager in favour of the "android" CLI, which
REM also writes licenses\ itself, so there is no separate license step.
REM The CLI returns a bogus exit code even on success, so we verify the result
REM on disk instead of trusting ERRORLEVEL.
REM Capacitor 8 builds against SDK 36 (see android/variables.gradle).
echo Installing android platform and build tools
call android sdk install "platforms;android-36"
if NOT EXIST "%CD%\androidsdk\platforms\android-36" goto :fail
call android sdk install "build-tools;36.0.0"
if NOT EXIST "%CD%\androidsdk\build-tools\36.0.0" goto :fail

echo All Done!
pause
exit /b 0

:fail
echo.
echo Setup failed. See the error above.
pause
exit /b 1