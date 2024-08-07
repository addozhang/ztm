import { request, merge, spread } from '@/service/common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
export default class ProxyService {
	getInfo() {
		return request(`/api/appinfo`);
	}
	getEndpoints() {
		return request(`/api/endpoints`);
	}
	getProxy(ep) {
		return request(`/api/endpoints/${ep}/config`)
	}
	setProxy({ep,listen,targets}) {
		const body = {};
		if(!!listen){
			body.listen = listen
		}
		const _targets = !!targets?targets.filter((t)=>!!t):[];
		if(_targets.length > 0){
			body.targets = _targets
		}
		return request(`/api/endpoints/${ep}/config`,"POST", body)
	}
}
