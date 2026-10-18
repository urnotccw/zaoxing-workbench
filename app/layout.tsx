import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'造形 · 角色设计工作台',description:'有依据的角色设计与同风格系列制作。'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>;}
