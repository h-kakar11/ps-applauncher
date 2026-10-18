' Double-click once: adds a "Game Library" shortcut to the Start menu and Desktop, ready to pin to the taskbar.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
For Each place In Array(sh.SpecialFolders("Programs"), sh.SpecialFolders("Desktop"))
  Set lnk = sh.CreateShortcut(place & "\Game Library.lnk")
  lnk.TargetPath = "wscript.exe"
  lnk.Arguments = """" & dir & "\Game Library.vbs"""
  lnk.WorkingDirectory = dir
  lnk.Description = "PS5-style game library"
  lnk.Save
Next
MsgBox "Added a Game Library shortcut to the Start menu and Desktop." & vbCrLf & vbCrLf & _
  "To pin it: press Win, type Game Library, right-click it, then Pin to taskbar.", 64, "Game Library"
