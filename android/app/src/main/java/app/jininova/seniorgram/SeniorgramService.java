package app.jininova.seniorgram;

import com.google.androidbrowserhelper.trusted.DelegationService;
import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;

public class SeniorgramService extends DelegationService {
    @Override public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }
}
