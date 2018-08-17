
![JSspeedometer](https://raw.githubusercontent.com/thangman22/js-speedometer/master/icon.png "JSspeedometer")

This is a repository of [JSspeedometer](https://js-speedometer.appspot.com/)

# Bundle Speedometer
Tool for benchmark parsing and execution time of JS script. Inspring by [Bundlephobia](https://github.com/pastelsky/bundlephobia) and [DeviceTiming](https://github.com/danielmendel/DeviceTiming).

## Feature
- Calculate parsing / execution time of JS
- Slect bundle from CDNJS or use custom url
- Calculate by eval script in real browser ( Puppeteer )

## Support
If you like JSspeedometer and it help you to make a good product. Just buy me a coffee

![Buy me a coffee](https://www.buymeacoffee.com/assets/img/custom_images/white_img.png "Buy me a coffee")
## FAQ

#### How it work?
js-speedometer will inject JS to template included evaluation script then open with Puppeteer and collect information from browser log. Script will run 3 times and calculate to average metric.

#### Why it so slow?
We run this script 3 times and each time will run by 4x slower CPU speed. Apoximity runing time is 1 mins.

## Development
- Edit `.env.sample` and re-name to `.env`
- Run `yarn install`
- Run `yarn start`
