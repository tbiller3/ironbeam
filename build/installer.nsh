!macro customInstall
  ; Add Windows Firewall rules silently
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="IRONBEAM"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="IRONBEAM" dir=in action=allow protocol=TCP localport=7443'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="IRONBEAM" dir=out action=allow protocol=TCP localport=7443'
!macroend

!macro customUnInstall
  ; Remove firewall rules on uninstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="IRONBEAM"'
!macroend
