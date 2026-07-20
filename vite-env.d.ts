/// <reference types="vite/client" />

// animal-island-ui 的样式子路径导入声明
declare module 'animal-island-ui/style';

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_AI_BASE_URL: string;
  readonly VITE_AI_API_KEY: string;
  readonly VITE_AI_MODEL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
