/**
 * The CLI exits without an error message when the user presses Ctrl + C.
 * @returns function.
 */
export function inquirerErrorHandle() {
  return (error: { name: string }) => {
    if (error.name !== "ExitPromptError") console.log(error);
    process.exit(0);
  };
}
