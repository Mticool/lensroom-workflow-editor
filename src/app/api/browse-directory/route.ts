import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// GET: Open native directory picker and return the selected path
export async function GET() {
  const platform = process.platform;

  try {
    let selectedPath: string | null = null;

    if (platform === "darwin") {
      // macOS: Use osascript to open folder picker
      const { stdout } = await execAsync(
        `osascript -e 'set folderPath to POSIX path of (choose folder with prompt "Select a folder to save workflows")' -e 'return folderPath'`
      );
      selectedPath = stdout.trim();
    } else if (platform === "win32") {
      // Windows: Use PowerShell to open folder picker
      const { stdout } = await execAsync(
        `powershell -command "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Select a folder to save workflows'; if ($dialog.ShowDialog() -eq 'OK') { $dialog.SelectedPath } else { '' }"`
      );
      selectedPath = stdout.trim();
    } else if (platform === "linux") {
      // Linux: Try zenity (common on GNOME) or kdialog (KDE)
      try {
        const { stdout } = await execAsync(
          `zenity --file-selection --directory --title="Select a folder to save workflows" 2>/dev/null`
        );
        selectedPath = stdout.trim();
      } catch {
        // Try kdialog as fallback
        try {
          const { stdout } = await execAsync(
            `kdialog --getexistingdirectory ~ --title "Select a folder to save workflows"`
          );
          selectedPath = stdout.trim();
        } catch {
          return NextResponse.json(
            {
              success: false,
              error:
                "No supported dialog tool found. Please install zenity or kdialog.",
            },
            { status: 500 }
          );
        }
      }
    } else {
      return NextResponse.json(
        { success: false, error: `Unsupported platform: ${platform}` },
        { status: 500 }
      );
    }

    // User cancelled the dialog
    if (!selectedPath) {
      return NextResponse.json({
        success: true,
        cancelled: true,
        path: null,
      });
    }

    // Remove trailing slash if present (except for root)
    if (selectedPath.length > 1 && selectedPath.endsWith("/")) {
      selectedPath = selectedPath.slice(0, -1);
    }

    return NextResponse.json({
      success: true,
      cancelled: false,
      path: selectedPath,
    });
  } catch (error) {
    // Check if user cancelled (osascript returns error code when cancelled)
    if (
      error instanceof Error &&
      (error.message.includes("User canceled") ||
        error.message.includes("-128"))
    ) {
      return NextResponse.json({
        success: true,
        cancelled: true,
        path: null,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to open dialog",
      },
      { status: 500 }
    );
  }
}
