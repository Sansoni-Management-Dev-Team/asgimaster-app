import 'react-native';

// react-native-web passes tabIndex (0 or -1) on Text through to the DOM, but React Native
// only declares it on View. AppText uses it so web headings can take programmatic focus.
declare module 'react-native' {
  interface TextProps {
    tabIndex?: 0 | -1 | undefined;
  }
}
