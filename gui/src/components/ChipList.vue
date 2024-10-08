<script setup>
import { ref, watch, useSlots } from 'vue';

const slots = useSlots();
const props = defineProps({
	list: {
			type: Array,
			default: ()=>{
				return [];
			}
	},
	direction: {
			type: String,
			default: 'h'
	},
	listKey: {
			type: String,
			default: null
	},
	placeholder: {
			type: String,
			default: 'Add'
	},
	icon: {
			type: String,
			default: 'pi-pencil'
	},
});
watch(() => props.list, () =>{
	if(!props.list){
		emits("update:list",[]);
	}
	if(props.list.length == 0){
		
		if(!props.listKey){
			props.list.push('')
		}else{
			const _temp = {};
			_temp[props.listKey] = ""
			props.list.push(_temp);
		}
	}
},{
	deep:true,
	immediate:true
})
const addTag = (tag) => {
	if(!props.listKey){
		if(!!tag){
			props.list.push("");
		}
	} else {
		if(!!tag[props.listKey]){
			const _temp = {};
			_temp[props.listKey] = ""
			props.list.push(_temp);
		}
	}
	emits("change",props.list);
}
const emits = defineEmits(['change','update:list']);
const removeTag = (index) => {
	props.list.splice(index,1);
	emits("change",props.list);
}
const typing = (e,idx) => {
	if(!props.listKey){
		props.list[idx] = e.target.value;
	} else {
		props.list[idx][props.listKey] = e.target.value;
	}
}
</script>

<template>
		<span v-if="props.direction == 'h'" v-for="(tag,tagidx) in props.list">
			<Chip v-if="tagidx<props.list.length - 1" class="mr-2 custom-chip" >
				<span v-if="!props.listKey">{{tag}}</span><span v-else>{{tag[props.listKey]}}</span>
				<i class="pi pi-times-circle" @click="removeTag(tagidx)"/>
			</Chip>
			<Chip v-else-if="!slots.input" class="pl-0 pr-3">
					<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
						<i class="pi" :class="icon"/>
					</span>
					<span class="ml-2 font-medium">
						<InputText v-if="!props.listKey" @keyup.enter="addTag(tag)" :placeholder="placeholder" class="add-tag-input xl" :unstyled="true" :value="tag" @input="typing($event,tagidx)" type="text" />
						<InputText v-else @keyup.enter="addTag(tag)" :placeholder="placeholder" class="add-tag-input xl" :unstyled="true" :value="tag[props.listKey]" @input="typing($event,tagidx)" type="text" />
						<i class="pi pi-arrow-down-left" />
					</span>
			</Chip>
			<slot v-else name="input"/>
		</span>
		<div v-else v-for="(tag,tagidx) in props.list">
			<Chip v-if="tagidx<props.list.length - 1" class="pl-0 custom-chip">
				<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
					<i class="pi" :class="icon"/>
				</span>
				<span class="ml-2 font-medium">
					<span v-if="!props.listKey">{{tag}}</span><span v-else>{{tag[props.listKey]}}</span>
					<i class="pi pi-times-circle" @click="removeTag(tagidx)"/>
				</span>
			</Chip>
			<Chip v-else-if="!slots.input" class="pl-0 pr-3">
					<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
						<i class="pi" :class="icon"/>
					</span>
					<span class="ml-2 font-medium">
						<InputText v-if="!props.listKey" @keyup.enter="addTag(tag)" :placeholder="placeholder" class="add-tag-input xl" :unstyled="true" :value="tag" @input="typing($event,tagidx)" type="text" />
						<InputText v-else @keyup.enter="addTag(tag)" :placeholder="placeholder" class="add-tag-input xl" :unstyled="true" :value="tag[props.listKey]" @input="typing($event,tagidx)" type="text" />
						<i class="pi pi-arrow-down-left" />
					</span>
			</Chip>
			<slot v-else name="input"/>
		</div>
</template>

<style scoped lang="scss">
	.custom-chip{
		line-height: 24px;
		margin-bottom: 10px;
	}
	.custom-chip .pi-times-circle{
		opacity: 0.5;
		transition: .3s all;
		cursor: pointer;
		position: relative;
		margin-left: 5px;
		vertical-align: middle;
	}
	.custom-chip .pi-times-circle:hover{
		opacity: 0.8;
	}
	.pi-arrow-down-left{
		opacity: 0.5;
		font-size: 10px;
	}
</style>