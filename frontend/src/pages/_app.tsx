import "@/styles/globals.css";
import { store } from "@/store";
import type { NextPage } from "next";
import type { AppProps } from "next/app";
import { Poppins } from "next/font/google";
import type { ReactElement, ReactNode } from "react";
import { Provider } from "react-redux";

export type NextPageWithLayout<P = object, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page: ReactElement) => page);
  return (
    <Provider store={store}>
      <div className={poppins.className}>{getLayout(<Component {...pageProps} />)}</div>
    </Provider>
  );
}
