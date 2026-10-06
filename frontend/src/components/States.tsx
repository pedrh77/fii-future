import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';
export const Loading = () => <div className="state"><LoaderCircle className="animate-spin" size={22} /> Carregando dados reais...</div>;
export const ErrorState = ({ message, retry }: { message: string; retry?: () => void }) => <div className="state error"><AlertCircle size={22} /><span>{message}</span>{retry && <button onClick={retry}><RefreshCw size={15} /> Tentar novamente</button>}</div>;
