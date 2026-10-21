' Double-click to open the game library (no console window).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir

' The library needs Node.js. Say so plainly instead of failing silently.
If sh.Run("cmd /c node --version", 0, True) <> 0 Then
  If MsgBox("Game Library needs Node.js, which isn't installed (or isn't on PATH)." & vbCrLf & vbCrLf & _
            "Open the Node.js download page now?", 36, "Game Library") = 6 Then
    sh.Run "https://nodejs.org/en/download"
  End If
  WScript.Quit 1
End If

sh.Run "node """ & dir & "\server.js"" --open", 0, False
