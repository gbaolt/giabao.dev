import {
  LinkIcon,
  MapPinIcon,
  MarsIcon,
  NonBinaryIcon,
  VenusIcon,
} from 'lucide-react';

import {
  IntroItem,
  IntroItemContent,
  IntroItemIcon,
  IntroItemLink,
} from '@/components/app/intro-item';
import { Panel, PanelContent } from '@/components/app/panel';
import { DrawUnderline } from '@/components/ui/draw-underline';
import { USER } from '@/features/portfolio/data/user';
import type { User } from '@/features/portfolio/types/user';
import { formatIncompletePhoneNumber } from '@/lib/libphonenumber';
import { decodePhoneNumber } from '@/utils/string';
import { urlToName } from '@/utils/url';

import { EmailItem } from './email-item';
import { JobItem } from './job-item';
import { LocalTimeItem } from './local-time-item';
import { PhoneItem } from './phone-item';
import { ResumeItem } from './resume-item';

export function Overview() {
  return (
    <Panel className="decor-t screen-line-bottom-none">
      <h2 className="sr-only">Profile overview</h2>

      <PanelContent className="space-y-2.5">
        <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
          <div className="space-y-2.5">
            {USER.jobs.map((job, index) => {
              return (
                <JobItem
                  key={index}
                  title={job.title}
                  company={job.company}
                  website={job.website}
                  experienceId={job.experienceId}
                />
              );
            })}
          </div>

          {USER.resume && (
            <div className="mt-auto">
              <ResumeItem />
            </div>
          )}
        </div>

        <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
          <IntroItem>
            <IntroItemIcon>
              <MapPinIcon />
            </IntroItemIcon>
            <IntroItemContent>
              <IntroItemLink
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(USER.address)}`}
                aria-label={`Location: ${USER.address}`}
              >
                <DrawUnderline>{USER.address}</DrawUnderline>
              </IntroItemLink>
            </IntroItemContent>
          </IntroItem>

          <LocalTimeItem timeZone={USER.timeZone} />
          <PhoneItem
            phoneNumber={USER.phoneNumber}
            formattedPhoneNumber={btoa(
              formatIncompletePhoneNumber(decodePhoneNumber(USER.phoneNumber))
            )}
          />
          <EmailItem email={USER.email} />

          <IntroItem>
            <IntroItemIcon>
              <LinkIcon />
            </IntroItemIcon>
            <IntroItemContent>
              <IntroItemLink
                href={USER.website}
                aria-label={`Personal website: ${urlToName(USER.website)}`}
              >
                <DrawUnderline>{urlToName(USER.website)}</DrawUnderline>
              </IntroItemLink>
            </IntroItemContent>
          </IntroItem>

          <IntroItem>
            <IntroItemIcon>{getGenderIcon(USER.gender)}</IntroItemIcon>
            <IntroItemContent aria-label={`Pronouns: ${USER.pronouns}`}>
              {USER.pronouns}
            </IntroItemContent>
          </IntroItem>
        </div>
      </PanelContent>
    </Panel>
  );
}

function getGenderIcon(gender: User['gender']) {
  switch (gender) {
    case 'male':
      return <MarsIcon />;
    case 'female':
      return <VenusIcon />;
    case 'non-binary':
      return <NonBinaryIcon />;
  }
}
