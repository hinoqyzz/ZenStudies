export function describePersistenceError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (name === "QuotaExceededError" || /quota/i.test(message)) {
    return "O espaço local do banco acabou. Exporte um backup e apague arquivos grandes antes de continuar.";
  }
  if (/not found|ausente|não encontrado/i.test(message)) return "O arquivo interno não foi encontrado.";
  if (/permiss|access|denied|EPERM|EACCES/i.test(message)) {
    return "O aplicativo não teve permissão para ler ou gravar o arquivo.";
  }
  if (/indexedDB|database|InvalidState|UnknownError/i.test(`${name} ${message}`)) {
    return "O banco local está indisponível. Feche outras janelas do ZenStudies e tente de novo.";
  }
  if (message.trim()) return message;
  return "Não foi possível concluir a operação local.";
}
