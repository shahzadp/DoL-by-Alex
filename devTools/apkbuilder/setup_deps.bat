@echo off
SETLOCAL

SET "PATH=%CD%\androidsdk\cmdline-tools\latest\bin;%CD%\androidsdk\gradle\bin;%PATH%"
SET "ANDROID_HOME=%CD%\androidsdk"
SET "ANDROID_SDK_ROOT=%ANDROID_HOME%"
SET "ANDROID_SDK_PATH=%ANDROID_HOME%"

REM note: the SDK folder is "cmdline-tools" (see README-windows.txt). all three
REM ANDROID_* vars must point at the same SDK so that setup and build agree.

if NOT EXIST "%CD%\androidsdk\cmdline-tools\latest\bin\android.exe" (
	echo cmdline-tools not found, follow the steps from README-windows.txt first!
	pause
	exit /b 1
)

REM install node dependencies
echo Installing node modules
call npm i --no-audit
if errorlevel 1 goto :fail

REM disable cordova telemetry
call npx cordova telemetry off
if errorlevel 1 goto :fail

REM install platform and plugins
call npx cordova prepare
if errorlevel 1 goto :fail

REM install android platform and build tools.
REM cmdline-tools 23 deprecates sdkmanager in favour of the "android" CLI, which
REM also writes licenses\ itself, so there is no separate license step.
REM The CLI returns a bogus exit code even on success, so we verify the result
REM on disk instead of trusting ERRORLEVEL.
echo Installing target android platform and build tools
call android sdk install "platforms;android-32"
if NOT EXIST "%CD%\androidsdk\platforms\android-32" goto :fail
call android sdk install "build-tools;32.0.0"
if NOT EXIST "%CD%\androidsdk\build-tools\32.0.0" goto :fail

echo All Done!
pause
exit /b 0

:fail
echo.
echo Setup failed. See the error above.
pause
exit /b 1
