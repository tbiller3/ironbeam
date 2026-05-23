; ─────────────────────────────────────────────────────────────────────────────
;  IRONBEAM NSIS Installer Customizations
; ─────────────────────────────────────────────────────────────────────────────

; Runs at the very start of the installer — kills any running IRONBEAM
; process so the old binary is unlocked and ready to be overwritten. No more
; "IRONBEAM cannot be closed" Retry/Cancel dialog.
!macro customInit
  ; Force-kill the main app + any electron/child processes by image name.
  ; /F = force, /T = also kill child processes.
  nsExec::ExecToLog 'taskkill /F /T /IM IRONBEAM.exe'
  ; Tiny pause so Windows fully releases the file handle before install begins
  Sleep 600
!macroend

!macro customInstall
  ; Wipe any old IRONBEAM firewall rules (idempotent — silent if missing)
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="IRONBEAM"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="IRONBEAM HTTP"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="IRONBEAM HTTPS"'

  ; Open BOTH ports inbound so iPhone Safari can reach the server.
  ; 7878 = plain HTTP  (default on first install — no cert install needed)
  ; 7443 = HTTPS+TLS   (used when iPhone has the IRONBEAM Trust profile)
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="IRONBEAM HTTP"  dir=in  action=allow protocol=TCP localport=7878'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="IRONBEAM HTTPS" dir=in  action=allow protocol=TCP localport=7443'

  ; Outbound for completeness (Windows usually allows outbound by default,
  ; but explicit rules survive future policy hardening).
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="IRONBEAM HTTP"  dir=out action=allow protocol=TCP localport=7878'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="IRONBEAM HTTPS" dir=out action=allow protocol=TCP localport=7443'
!macroend

!macro customUnInstall
  ; Kill any running IRONBEAM before uninstall too
  nsExec::ExecToLog 'taskkill /F /T /IM IRONBEAM.exe'
  Sleep 400
  ; Remove all firewall rules
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="IRONBEAM"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="IRONBEAM HTTP"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="IRONBEAM HTTPS"'
!macroend
