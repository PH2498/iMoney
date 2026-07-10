import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './helloworld.less'

export default function Helloworld() {
  useLoad(() => {
    console.log('Helloworld page loaded.')
  })

  return (
    <View className='helloworld'>
      <Text className='helloworld-title'>Hello World</Text>
      <Text className='helloworld-desc'>欢迎使用 Taro 小程序开发框架</Text>
    </View>
  )
}